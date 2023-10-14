// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;
pragma abicoder v2;


// TODO: sort function per visibility

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;
    using SafeMath for int256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    // Account used to deploy contract
    address private contractOwner;


    mapping(address => bool) private authorizedCallers;

    struct AirlineData {
        string name;
        int funding;
    }
    mapping(address => AirlineData) private airlines;
    address[] private airlineAccounts;

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    /**
    * @dev Constructor
    *      The deploying account becomes contractOwner
    */
    constructor(
        address firstAirlineAccount,
        string memory firstAirlineName
    ) {
        contractOwner = msg.sender;
        _addAirline(firstAirlineAccount, firstAirlineName);
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.


    /**
    * @dev Modifier that requires the "ContractOwner" account to be the function caller
    */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireAuthorizedCaller() {
        require(authorizedCallers[msg.sender], "Caller is not authorized");
        _;
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    function authorizeCaller(address _caller) external requireContractOwner {
        authorizedCallers[_caller] = true;
    }

    function deauthorizeCaller(address _caller) external requireContractOwner {
        authorizedCallers[_caller] = false;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    function _addAirline(address airlineAccount, string memory airlineName) private {
        airlines[airlineAccount].name = airlineName;
        airlineAccounts.push(airlineAccount);
    }
   /**
    * @dev Add an airline to the registration queue
    *      Can only be called from FlightSuretyApp contract
    *
    */
    function addAirline(
        address airlineAccount,
        string memory airlineName
    )
        external
        requireAuthorizedCaller
    {
        _addAirline(airlineAccount, airlineName);
    }

    function getAirlineData(
        address _account
    )
        external
        view
        requireAuthorizedCaller
        returns (
            AirlineData memory
        )
    {
        return airlines[_account];
    }

    function getAirlineNames()
        external
        view
        requireAuthorizedCaller
        returns(
            string[] memory
    ){
        string[] memory names = new string[](airlineAccounts.length);
        for (uint i = 0; i < airlineAccounts.length; i++) {
            names[i] = airlines[airlineAccounts[i]].name;
        }
        return names;
    }

    function getAirlinesCount() external view returns (uint) {
        return airlineAccounts.length;
    }

    function updateAirlineFunding(
        address _airlineAccount,
        int _funding
    )
        external
        requireAuthorizedCaller
    {
        airlines[_airlineAccount].funding = airlines[_airlineAccount].funding + _funding;
    }

   /**
    * @dev Buy insurance for a flight
    *
    */
    function buy
                            (
                            )
                            external
                            payable
    {

    }

    /**
     *  @dev Credits payouts to insurees
    */
    function creditInsurees
                                (
                                )
                                external
                                pure
    {
    }


    /**
     *  @dev Transfers eligible payout funds to insuree
     *
    */
    function pay
                            (
                            )
                            external
                            pure
    {
    }

   /**
    * @dev Initial funding for the insurance. Unless there are too many delayed flights
    *      resulting in insurance payouts, the contract should be self-sustaining
    *
    */
    function fund() public payable {
    }

    function getFlightKey
                        (
                            address airline,
                            string memory flight,
                            uint256 timestamp
                        )
                        pure
                        internal
                        returns(bytes32)
    {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    /**
    * @dev Fallback function for funding smart contract.
    *
    */
    receive() external payable {
        require(msg.data.length == 0, "Message data should be empty");

        fund();
    }
}
