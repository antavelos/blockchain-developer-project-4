// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

library DataTypes {
    struct AirlineData {
        string name;
        bool hasFunded;
    }

    struct FlightInsuranceData {
        uint256 amount;
        uint256 refundAmount;
        bool refundWithdrawn;
    }

    struct FlightData {
        uint8 statusCode;
        bool statusCodeVerified;
        uint256 updatedTimestamp;
        address airline;
    }
}