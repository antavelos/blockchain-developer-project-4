// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;
pragma abicoder v2;


// It's important to avoid vulnerabilities due to numeric overflow bugs
// OpenZeppelin's SafeMath library, when used correctly, protects agains such bugs
// More info: https://www.nccgroup.trust/us/about-us/newsroom-and-events/blog/2018/november/smart-contract-insecurity-bad-arithmetic/

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./DataTypes.sol";

contract IFlightSuretyData {
    function addAirline(address, string memory) external { }
    function getAirlineData(address) external view returns (DataTypes.AirlineData memory) { }
    function getAirlineNames() external view returns (string[] memory) { }
    function getAirlineAccounts() external view returns (address[] memory) { }
    function getAirlinesCount() external view returns (uint) { }
    function setAirlineFunded(address) external { }
    function addFlight(address, string memory) external { }
    function updateFlight(string memory, uint8, bool) external { }
    function getFlightData(string memory) external view returns (DataTypes.FlightData memory) { }
    function getFlightCodes() external view returns (string[] memory) { }
    function addFlightInsurance(address, string memory, uint256) external { }
    function getFlightInsuranceData(address, string memory) external view returns (DataTypes.FlightInsuranceData memory) { }
    function updateFlightInsuranceData(address, string memory, DataTypes.FlightInsuranceData memory) external { }
    function getInsuredPassengers(string memory) external view returns (address[] memory) { }
}

contract FlightSuretyApp {
    using SafeMath for uint256; // Allow SafeMath functions to be called for all uint256 types (similar to "prototype" in Javascript)

    IFlightSuretyData dataContract;

    uint256 private constant MIN_AIRLINE_FUND = 10 ether;
    uint256 private constant MIN_NO_VOTE_AIRLINES_NUM = 4;
    uint256 private constant MAX_INSURANCE_AMOUNT = 1 ether;

    // refund policy: 1.5 x insurance amount
    uint256 private constant INSURANCE_REFUND_CALCULATION_NUMERATOR = 3;
    uint256 private constant INSURANCE_REFUND_CALCULATION_DENOMINATOR = 2;

    // Flight status codes
    uint8 private constant STATUS_CODE_UNKNOWN = 0;
    uint8 private constant STATUS_CODE_ON_TIME = 10;
    uint8 private constant STATUS_CODE_LATE_AIRLINE = 20;
    uint8 private constant STATUS_CODE_LATE_WEATHER = 30;
    uint8 private constant STATUS_CODE_LATE_TECHNICAL = 40;
    uint8 private constant STATUS_CODE_LATE_OTHER = 50;

    address private contractOwner;

    mapping(address => address[]) votesPerCandidateAirline;

    bool private operational = true;

    // ORACLES

    // Incremented to add pseudo-randomness at various points
    uint8 private nonce = 0;

    // Fee to be paid when registering oracle
    uint256 public constant ORACLE_REGISTRATION_FEE = 1 ether;

    uint256 public constant ORACLE_INDEXES_COUNT = 3;

    // Number of oracles that must respond for valid status
    uint256 private constant MIN_ORACLE_RESPONSES = 3;


    struct Oracle {
        bool isRegistered;
        uint8[ORACLE_INDEXES_COUNT] indexes;
    }

    // Track all registered oracles
    mapping(address => Oracle) private oracles;

    // Model for responses from oracles
    struct ResponseInfo {
        // Account that requested status
        address requester;

        // If open, oracle responses are accepted
        bool isOpen;

        // Mapping key is the status code reported
        // This lets us group responses and identify
        // the response that majority of the oracles
        mapping(uint8 => address[]) responses;
    }

    // Track all oracle responses
    // Key = hash(index, flight, timestamp)
    mapping(bytes32 => ResponseInfo) private oracleResponses;

    // Event fired each time an oracle submits a response
    event FlightStatusReceived(address airline, string flightCode, uint256 timestamp, uint8 statusCode, bool verified);

    // event OracleReport(address airline, string flight, uint256 timestamp, uint8 status);

    // Event fired when flight status request is submitted
    // Oracles track this and if they have a matching index
    // they fetch data and submit a response
    event FlightStatusRequested(uint8 oracleIndex, address airline, string flightCode, uint256 timestamp);

    event FlightInsuranceRefundCredited(address passenger, string flightCode, uint256 refundAmount);

    // TODO: remove
    event Debug(string text);

    /**
    * @dev Modifier that requires the "operational" boolean variable to be "true"
    *      This is used on all state changing functions to pause the contract in
    *      the event there is an issue that needs to be fixed
    */
    modifier requireOperational() {
        require(operational, "Contract is not currently operational");
        _;
    }

    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier callerAirlineCanParticipate() {
        DataTypes.AirlineData memory data = dataContract.getAirlineData(msg.sender);

        require(bytes(data.name).length > 0, "Caller is not a registered airline");

        require(data.hasFunded, "Caller has not submitted sufficient funding yet");

        _;
    }

    modifier isRegisteredAirline(address airline) {
        DataTypes.AirlineData memory data = dataContract.getAirlineData(airline);

        require(bytes(data.name).length > 0, "Caller is not a registered airline");

        _;
    }

    modifier insuranceAmountIsBelowThreshold() {
        require(msg.value <= MAX_INSURANCE_AMOUNT, "Max insurance amount is 1 ETH");
        _;
    }

    modifier requireRegisteredFlight(string memory _flightCode) {
        DataTypes.FlightData memory data = dataContract.getFlightData(_flightCode);

        require(data.airline != address(0), "Flight is not registered");

        _;
    }

    modifier requireNotRegisteredFlight(string memory _flightCode) {
        DataTypes.FlightData memory data = dataContract.getFlightData(_flightCode);

        require(data.airline == address(0), "Flight is already registered");

        _;
    }
    /********************************************************************************************/
    /*                                       CONSTRUCTOR                                        */
    /********************************************************************************************/

    /**
    * @dev Contract constructor
    *
    */
    constructor(address _dataContract) {
        contractOwner = msg.sender;
        dataContract = IFlightSuretyData(_dataContract);
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function isOperational() external view returns (bool) {
        return operational;
    }

    function setOperatingStatus(bool mode) external requireContractOwner {
        operational = mode;
    }

    // TODO: move to library
    function addressExists(address[] memory _addresses, address _address) private pure returns (bool) {
        for (uint i = 0; i < _addresses.length; i++) {
            if (_addresses[i] == _address) {
                return true;
            }
        }
        return false;
    }

    function hasConsensus(uint256 votesNum, uint256 totalNum) private pure returns (bool) {
        // prevents below 1 result in following calculation
        uint256 multiplier = 10;

        return votesNum.mul(multiplier).div(totalNum) >= 5;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    function getAirlineNames() external view requireOperational returns (string[] memory){
        return dataContract.getAirlineNames();
    }

    function getAirlineData(address airlineAccount) external view requireOperational returns (DataTypes.AirlineData memory){
        return dataContract.getAirlineData(airlineAccount);
    }

    function fundAirline() external payable isRegisteredAirline(msg.sender)
    {
        require(msg.value >= MIN_AIRLINE_FUND, "Not sufficient funding amount");

        dataContract.setAirlineFunded(msg.sender);
    }

   /**
    * @dev Add an airline to the registration queue
    *
    */
    function registerAirline(
        address newAirlineAccount,
        string memory newAirlineName
    )
        external
        requireOperational
        callerAirlineCanParticipate
    {
        DataTypes.AirlineData memory data = dataContract.getAirlineData(newAirlineAccount);

        require(bytes(data.name).length == 0, "Airline is already registered");

        uint256 totalAirlinesCount = dataContract.getAirlinesCount();

        if (totalAirlinesCount < MIN_NO_VOTE_AIRLINES_NUM ) {
            dataContract.addAirline(newAirlineAccount, newAirlineName);
            return;
        }

        address[] storage votes = votesPerCandidateAirline[newAirlineAccount];

        require(!addressExists(votes, msg.sender), "Caller has alredy voted for the candidate airline");

        votes.push(msg.sender);

        uint256 totalVotesCount = votes.length;

        if (!hasConsensus(totalVotesCount, totalAirlinesCount)) {
            return;
        }

        dataContract.addAirline(newAirlineAccount, newAirlineName);
    }

    function getFlightInsuranceData(
        address passenger,
        string memory flightCode
    )
        external
        view
        requireOperational

        returns (DataTypes.FlightInsuranceData memory)
    {
        return dataContract.getFlightInsuranceData(passenger, flightCode);
    }

    function buyInsurance(
        string memory flightCode
    )
        external
        payable
        requireOperational
        requireRegisteredFlight(flightCode)
        insuranceAmountIsBelowThreshold
    {
        dataContract.addFlightInsurance(msg.sender, flightCode, msg.value);
    }

    function withdrawInsuranceRefund(
        string memory flightCode
    )
        external
        requireOperational
        requireRegisteredFlight(flightCode)
    {
        DataTypes.FlightInsuranceData memory insuranceData = dataContract.getFlightInsuranceData(
            msg.sender,
            flightCode
        );

        require (insuranceData.refundAmount > 0, "No refund has been issued yet");

        uint refundAmount = insuranceData.refundAmount;
        insuranceData.refundAmount = 0;
        insuranceData.refundWithdrawn = true;
        dataContract.updateFlightInsuranceData(msg.sender, flightCode, insuranceData);

        (bool success, ) = msg.sender.call{value: refundAmount}("");
        require(success, "Refund withdrawal failed");
    }

    function calculateRefundAmount(uint256 amount) private pure returns (uint256) {
        return amount.mul(INSURANCE_REFUND_CALCULATION_NUMERATOR).div(INSURANCE_REFUND_CALCULATION_DENOMINATOR);
    }
   /**
    * @dev Register a future flight for insuring.
    *
    */
    function registerFlight(
        string memory flightCode
    )
        external
        requireOperational
        isRegisteredAirline(msg.sender)
        requireNotRegisteredFlight(flightCode)
    {
        dataContract.addFlight(msg.sender, flightCode);
    }

    function getFlightCodes() external view requireOperational returns (string[] memory){
        return dataContract.getFlightCodes();
    }
   /**
    * @dev Called after oracle has updated flight status
    *
    */
    function processFlightStatus(
        // address airline,
        string memory flightCode,
        // uint256 timestamp,
        uint8 statusCode
    )
        internal
    {
        if (statusCode == STATUS_CODE_LATE_AIRLINE) {
            handleStatusCodeLateAirline(flightCode);
        }
    }

    function handleStatusCodeLateAirline(string memory flightCode) internal {
        address[] memory insuredPassengers = dataContract.getInsuredPassengers(flightCode);

        for (uint i = 0; i < insuredPassengers.length; i++) {
            DataTypes.FlightInsuranceData memory insuranceData = dataContract.getFlightInsuranceData(
                insuredPassengers[i],
                flightCode
            );

            insuranceData.refundAmount = calculateRefundAmount(insuranceData.amount);

            dataContract.updateFlightInsuranceData(
                insuredPassengers[i],
                flightCode,
                insuranceData
            );

            emit FlightInsuranceRefundCredited(insuredPassengers[i], flightCode, insuranceData.refundAmount);
        }
    }

    function getFlightData(string memory flightCode) external view requireOperational returns (DataTypes.FlightData memory) {
        return dataContract.getFlightData(flightCode);
    }
    // Generate a request for oracles to fetch flight information
    function fetchFlightStatus(
        // address airline,
        string memory flightCode,
        uint256 timestamp
    )
        external
        requireOperational
        requireRegisteredFlight(flightCode)
    {
        DataTypes.FlightData memory flightData = dataContract.getFlightData(flightCode);

        require(!flightData.statusCodeVerified, "Status code is already verified");

        uint8 index = getRandomIndex(msg.sender);

        // Generate a unique key for storing the request
        bytes32 key = getFlightKey(index, flightData.airline, flightCode, timestamp);

        ResponseInfo storage responseInfo = oracleResponses[key];
        responseInfo.requester = msg.sender;
        responseInfo.isOpen = true;

        emit FlightStatusRequested(index, flightData.airline, flightCode, timestamp);
    }

    // Register an oracle with the contract
    function registerOracle() external payable requireOperational {
        require(msg.value >= ORACLE_REGISTRATION_FEE, "Insufficient registration fee");

        require(!oracles[msg.sender].isRegistered, "Oracle is already registered");

        uint8[ORACLE_INDEXES_COUNT] memory indexes = generateIndexes(msg.sender);

        oracles[msg.sender] = Oracle({
            isRegistered: true,
            indexes: indexes
        });
    }

    function getMyIndexes() external view returns (uint8[ORACLE_INDEXES_COUNT] memory) {
        require(oracles[msg.sender].isRegistered, "Not registered as an oracle");

        return oracles[msg.sender].indexes;
    }

    function oracleHasIndex(address oracleAccount, uint8 index) internal view returns (bool) {
        uint8[ORACLE_INDEXES_COUNT] storage indexes = oracles[oracleAccount].indexes;
        for (uint i = 0; i < ORACLE_INDEXES_COUNT; i++) {
            if (indexes[i] == index) {
                return true;
            }
        }
        return false;
    }

    // Called by oracle when a response is available to an outstanding request
    // For the response to be accepted, there must be a pending request that is open
    // and matches one of the three Indexes randomly assigned to the oracle at the
    // time of registration (i.e. uninvited oracles are not welcome)
    function updateFlightStatus(
        uint8 oracleIndex,
        address airline,
        string memory flightCode,
        uint256 timestamp,
        uint8 statusCode
    )
        external
        requireOperational
    {
        require(oracleHasIndex(msg.sender, oracleIndex), "Oracle index mismatch");

        bytes32 key = getFlightKey(oracleIndex, airline, flightCode, timestamp);

        require(oracleResponses[key].requester != address(0), "Invalid parameters");

        require(oracleResponses[key].isOpen, "Request is closed");

        oracleResponses[key].responses[statusCode].push(msg.sender);

        bool verified = oracleResponses[key].responses[statusCode].length == MIN_ORACLE_RESPONSES;

        if (verified) {
            oracleResponses[key].isOpen = false;
            processFlightStatus(flightCode, statusCode);
        }
        dataContract.updateFlight(flightCode, statusCode, verified);

        emit FlightStatusReceived(airline, flightCode, timestamp, statusCode, verified);
    }

    function getFlightKey(
        uint8 index,
        address airline,
        string memory flight,
        uint256 timestamp
    )
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(index, airline, flight, timestamp));
    }

    // Returns array of three non-duplicating integers from 0-9
    function generateIndexes(address account) internal returns (uint8[3] memory) {
        uint8[3] memory indexes;
        indexes[0] = getRandomIndex(account);

        indexes[1] = indexes[0];
        while(indexes[1] == indexes[0]) {
            indexes[1] = getRandomIndex(account);
        }

        indexes[2] = indexes[1];
        while((indexes[2] == indexes[0]) || (indexes[2] == indexes[1])) {
            indexes[2] = getRandomIndex(account);
        }

        return indexes;
    }

    // TODO: move to library
    // Returns array of three non-duplicating integers from 0-9
    function getRandomIndex(address account) internal returns (uint8) {
        uint8 maxValue = 10;

        // Pseudo random number...the incrementing nonce adds variation
        uint8 random = uint8(uint256(keccak256(abi.encodePacked(blockhash(block.number - nonce++), account))) % maxValue);

        if (nonce > 250) {
            nonce = 0;  // Can only fetch blockhashes for last 256 blocks so we adapt
        }

        return random;
    }

    receive() external payable {
        require(msg.data.length == 0, "Message data should be empty");
    }
}
