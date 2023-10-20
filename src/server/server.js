import config from './config.json';
import * as utils from '../utils.js';
import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Web3 from 'web3';
import express from 'express';

const ORACLE_REGISTRATION_FEE = utils.ethToWei(1);
const STATUS_CODE_UNKNOWN = 0;
const STATUS_CODE_ON_TIME = 10;
const STATUS_CODE_LATE_AIRLINE = 20;
const STATUS_CODE_LATE_WEATHER = 30;
const STATUS_CODE_LATE_TECHNICAL = 40;
const STATUS_CODE_LATE_OTHER = 50;

const statusCodes = [
  STATUS_CODE_UNKNOWN,
  STATUS_CODE_ON_TIME,
  STATUS_CODE_LATE_AIRLINE,
  STATUS_CODE_LATE_WEATHER,
  STATUS_CODE_LATE_TECHNICAL,
  STATUS_CODE_LATE_OTHER
];

let web3 = new Web3(new Web3.providers.WebsocketProvider(config.provider.replace('http', 'ws')));
// web3.eth.defaultAccount = web3.eth.accounts[0];

let flightSuretyApp;
let flightSuretyData;
let accounts;
let owner;
let airlineAccounts;
let passengerAccounts;
let oracleAccounts;
let flights = [];

(async function() {
  accounts = await web3.eth.getAccounts();
  owner = accounts[0]
  airlineAccounts = accounts.slice(1, 6);
  passengerAccounts = accounts.slice(6, 20);
  oracleAccounts = accounts.slice(20, 40);

  await init();

}());

async function initContracts() {
  flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.contracts.app);
  flightSuretyData = new web3.eth.Contract(FlightSuretyData.abi, config.contracts.data);

  await flightSuretyData.methods.authorizeCaller(owner).send({from: owner});
  await flightSuretyData.methods.authorizeCaller(config.contracts.app).send({from: owner});
}

async function initEvents() {
  flightSuretyApp.events.FlightStatusRequested({ fromBlock: 0 }, async (error, event) => {
    console.log("Received FlightStatusRequested:", event.returnValues);
    for (let i = 0; i < oracleAccounts.length; i++) {
      let indexes = await flightSuretyApp.methods.getMyIndexes().call({from: oracleAccounts[i]});
      if (indexes.includes(event.returnValues.oracleIndex)) {
        const statusCode = statusCodes[utils.randomInt(statusCodes.length)];

        try {
          await flightSuretyApp.methods.updateFlightStatus(
            event.returnValues.oracleIndex,
            event.returnValues.airline,
            event.returnValues.flightCode,
            event.returnValues.timestamp,
            statusCode)
            .send({from: oracleAccounts[i], gas: 1000000});
          console.log(`Oracle ${i} (${indexes}) sent: ${statusCode}`)
        } catch(err) {
          console.log(`Oracle ${i} error: ${utils.cleanError(err)}`);
        }
      }
    }
  });

  flightSuretyApp.events.FlightStatusReceived({ fromBlock: 0 }, (error, event) => {
    console.log(`Received FlightStatusReceived --> Flight ${event.returnValues.flightCode}: ${event.returnValues.statusCode} (${event.returnValues.verified})`);
  });

  // TODO: remove
  flightSuretyApp.events.Debug({ fromBlock: 0 }, (error, event) => {
    console.log("----------> DEBUG <----------:", event.returnValues);
  });
}

async function initAirlines() {
  const fund = async (airlineAccount) => {
    const data = await flightSuretyData.methods.getAirlineData(airlineAccount).call({from: owner});
    if (!data.hasFunded) {
      console.log(`\Airline '${data.name}' initial fund: 10 ETH`);
      await flightSuretyApp.methods.fundAirline().send({from: airlineAccount, value: utils.ethToWei(10)});
    }
  }

  const register = async (airlineAccount, fromAirline) => {
    const airlineName = `AIR${utils.randomStr(4)}`;
    const msg = `Airline ${airlineAccount}`;
    try {
      await flightSuretyApp.methods.registerAirline(
        airlineAccount,
        airlineName
      ).send({from: fromAirline, gas: 1000000});
      console.log(`${msg}: [OK]`)
    } catch(err) {
      console.log(`${msg}: [NOK]: ${utils.cleanError(err)}`);
    }
  }

  // the first airline is already registered upon deployment
  const firstAirline = airlineAccounts[0];
  await fund(firstAirline);

  console.log("\nRegistering airlines without conensus\n");

  // register 3 more flights
  for (let i = 1; i < 4; i++) {
    const airlineAccount = airlineAccounts[i];
    await register(airlineAccount, firstAirline);
  }

  console.log("\nRegistering airlines with conensus\n");

  //register one more flight with consensus
  await register(airlineAccounts[4], airlineAccounts[0]);

  await fund(airlineAccounts[1]);
  await register(airlineAccounts[4], airlineAccounts[1]);

  console.log("\nRegistered airline names:");
  console.log(await flightSuretyData.methods.getAirlineNames().call({from: owner}))
};

async function initFlights() {
  const flightCodes = await flightSuretyData.methods.getFlightCodes().call({from: owner});
  if (flightCodes.length === 0) {
    console.log("\nRegistering flights\n");

    const register = async (flightCode, airlineAccount) => {
      const msg = `Flight ${flightCode}`;
      let success = true;
      try {
        await flightSuretyApp.methods.registerFlight(flightCode).send({from: airlineAccount, gas: 1000000});
        console.log(`${msg}: [OK]`);
      } catch(err) {
        console.log(`${msg}: [NOK]: ${utils.cleanError(err)}`);
        success = false;
      }
      return success;
    }

    for(let i = 0; i < airlineAccounts.length; i++) {
      for (let j = 0; j < 5; j++) {
        const flightCode = `F-${utils.randomStr(6)}`;
        if (await register(flightCode, airlineAccounts[i])) {
          flights.push(flightCode);
        }
      }
    }
  }
  console.log("\nRegistered flight codes:");
  console.log(await flightSuretyData.methods.getFlightCodes().call({from: owner}));
}

async function init() {
  await initContracts();
  await initAirlines();
  await initFlights();
  await initOracles();
  await initEvents();

};

async function initOracles() {
  console.log("\nRegistering oracles\n");

  for(let i = 0; i < oracleAccounts.length; i++) {
    const oracleAccount = oracleAccounts[i];

    const msg = `Oracle ${oracleAccount}`;
    try {
      await flightSuretyApp.methods.registerOracle().send({from: oracleAccount, value: ORACLE_REGISTRATION_FEE, gas: 1000000});
      console.log(`${msg}: [OK]`)
    } catch(err) {
      console.log(`${msg}: [NOK]: ${utils.cleanError(err)}`);
    }
  }
};

async function fetchFlightStatus() {
  const timestamp = utils.now();

  await flightSuretyApp.methods.fetchFlightStatus(flightCode, timestamp).call()
};

const app = express();
app.get('/api', async (req, res) => {
  res.send({
    message: 'An API for use with your Dapp!'
  });
});
app.get('/fetch', async (req, res) => {
  const flightCode = req.query.flightCode;
  const timestamp = utils.now();

  await flightSuretyApp.methods.fetchFlightStatus(flightCode, timestamp).send({from: owner, gas: 1000000});

  res.send({
    message: "Request submited",
  });
});
export default app;
