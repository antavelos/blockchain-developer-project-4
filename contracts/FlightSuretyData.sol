// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import "./DataTypes.sol";

contract FlightSuretyData {
    address private contractOwner;

    mapping(address => bool) private authorizedCallers;

    mapping(address => DataTypes.AirlineData) private airlines;
    address[] private airlineAccounts;

    mapping(string => mapping(address => DataTypes.FlightInsuranceData)) private insurances;
    mapping(string => address[]) private insuredPassengers;

    mapping(string => DataTypes.FlightData) private flights;
    string[] private flightCodes;


    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

    modifier requireAuthorizedCaller() {
        require(authorizedCallers[msg.sender], "Caller is not authorized");
        _;
    }

    constructor(
        address firstAirlineAccount,
        string memory firstAirlineName
    ) {
        contractOwner = msg.sender;
        _addAirline(firstAirlineAccount, firstAirlineName);
    }

    function authorizeCaller(address _caller) external requireContractOwner {
        authorizedCallers[_caller] = true;
    }

    function deauthorizeCaller(address _caller) external requireContractOwner {
        authorizedCallers[_caller] = false;
    }

    function addAirline(
        address airlineAccount,
        string memory airlineName
    )
        external
        requireAuthorizedCaller
    {
        _addAirline(airlineAccount, airlineName);
    }

    function addFlight(
        address airline,
        string memory flightCode
    )
        external
        requireAuthorizedCaller
    {
        DataTypes.FlightData storage data = flights[flightCode];
        data.updatedTimestamp = block.timestamp;
        data.airline = airline;

        flightCodes.push(flightCode);
    }

    function updateFlight(
        string memory flightCode,
        uint8 statusCode,
        bool statusCodeVerified
    )
        external
        requireAuthorizedCaller
    {
        flights[flightCode].statusCode = statusCode;
        flights[flightCode].statusCodeVerified = statusCodeVerified;
        flights[flightCode].updatedTimestamp = block.timestamp;
    }

    function setAirlineFunded(
        address airlineAccount
    )
        external
        requireAuthorizedCaller
    {
        airlines[airlineAccount].hasFunded = true;
    }

    function addFlightInsurance(
        address passenger,
        string memory flightCode,
        uint256 amount
    )
        external
        requireAuthorizedCaller
    {
        insurances[flightCode][passenger] = DataTypes.FlightInsuranceData({
            amount: amount,
            refundAmount: 0,
            refundWithdrawn: false
        });
        insuredPassengers[flightCode].push(passenger);
    }

    function updateFlightInsuranceData(
        address passenger,
        string memory flightCode,
        DataTypes.FlightInsuranceData memory data
    )
        external
        requireAuthorizedCaller
    {
        insurances[flightCode][passenger] = data;
    }

    function getFlightCodes() external view requireAuthorizedCaller returns (string[] memory) {
        return flightCodes;
    }

    function getAirlineData(
        address _account
    )
        external
        view
        requireAuthorizedCaller
        returns (
            DataTypes.AirlineData memory
        )
    {
        return airlines[_account];
    }

    function getAirlineAccounts() external view requireAuthorizedCaller returns (address[] memory) {
        return airlineAccounts;
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

    function getFlightData(
        string memory flightCode
    )
        external
        view
        requireAuthorizedCaller

        returns (
            DataTypes.FlightData memory
        )
    {
        return flights[flightCode];
    }

    function getFlightInsuranceData(
        address passenger,
        string memory flightCode
    )
        external
        view
        requireAuthorizedCaller

        returns (DataTypes.FlightInsuranceData memory)
    {
        return insurances[flightCode][passenger];
    }

    function getInsuredPassengers(
        string memory flightCode
    )
        external
        view
        requireAuthorizedCaller

        returns (
            address[] memory
        )
    {
        return insuredPassengers[flightCode];
    }

    function _addAirline(address airlineAccount, string memory airlineName) private {
        airlines[airlineAccount].name = airlineName;
        airlineAccounts.push(airlineAccount);
    }
}
