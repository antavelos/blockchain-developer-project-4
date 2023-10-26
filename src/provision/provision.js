import config from '../../config/config.json';
import * as utils from '../utils.js';
import AppContract  from '../contracts/appContract.js';
import DataContract from '../contracts/dataContract.js';
import Web3 from 'web3';

const ORACLE_REGISTRATION_FEE_IN_ETH = 1;

const cleanError = (error) => {
  const msg = "Error: Returned error: VM Exception while processing transaction: revert";
  return error.toString().replace(msg, "");
}

const statusCodes = {
  STATUS_CODE_UNKNOWN: 0,
  STATUS_CODE_ON_TIME: 10,
  STATUS_CODE_LATE_AIRLINE: 20,
  STATUS_CODE_LATE_WEATHER: 30,
  STATUS_CODE_LATE_TECHNICAL: 40,
  STATUS_CODE_LATE_OTHER: 50,
};

const Prov = {
  appContract: null,
  owner: null,
  airlineAccounts: [],
  oracleAccounts: [],
  flights: [],

  init: async () => {
    const web3 = new Web3(new Web3.providers.WebsocketProvider(config.provider.replace('http', 'ws')));

    await Prov.initAccounts(web3);
    await Prov.initContracts(web3);
    await Prov.initAirlines();
    await Prov.initFlights();
    await Prov.initOracles();
  },

  initAccounts: async (web3) => {
    const accounts = await web3.eth.getAccounts();

    Prov.owner = accounts[0]
    Prov.airlineAccounts = accounts.slice(1, 6);
    Prov.oracleAccounts = accounts.slice(20, 40);
  },

  initContracts: async (web3) => {
    Prov.appContract = new AppContract(web3);
    const dataContract = new DataContract(web3);

    await dataContract.authorizeCaller(Prov.appContract.address, Prov.owner);
  },


  initAirlines: async () => {
    const fund = async (airlineAccount) => {
      const data = await Prov.appContract.getAirlineData(airlineAccount);
      if (!data.hasFunded) {
        console.log(`\Airline '${data.name}' initial fund: 10 ETH`);
        await Prov.appContract.fundAirline(10, airlineAccount);
      }
    }

    const register = async (airlineAccount, fromAirline) => {
      const airlineName = `AIR-${utils.randomStr(4)}`;
      const msg = `Airline ${airlineAccount}`;
      try {
        await Prov.appContract.registerAirline(airlineAccount, airlineName, fromAirline);
        console.log(`${msg}: [OK]`)
      } catch(err) {
        console.log(`${msg}: [NOK]: ${cleanError(err)}`);
      }
    }

    // the first airline is already registered upon deployment
    const firstAirline = Prov.airlineAccounts[0];
    await fund(firstAirline);

    console.log("\nRegistering airlines without consensus\n");

    // register 3 more flights
    for (let i = 1; i < 4; i++) {
      const airlineAccount = Prov.airlineAccounts[i];
      await register(airlineAccount, firstAirline);
    }

    console.log("\nRegistering airlines with consensus\n");

    //register one more flight with consensus
    await register(Prov.airlineAccounts[4], Prov.airlineAccounts[0]);

    await fund(Prov.airlineAccounts[1]);
    await register(Prov.airlineAccounts[4], Prov.airlineAccounts[1]);

    console.log("\nRegistered airline names:");
    console.log(await Prov.appContract.getAirlineNames());
  },

  initFlights: async () => {
    const flightCodes = await Prov.appContract.getFlightCodes();
    if (flightCodes.length === 0) {
      console.log("\nRegistering flights\n");

      const register = async (flightCode, airlineAccount) => {
        const msg = `Flight ${flightCode}`;
        let success = true;
        try {
          await Prov.appContract.registerFlight(flightCode, airlineAccount);
          console.log(`${msg}: [OK]`);
        } catch(err) {
          console.log(`${msg}: [NOK]: ${cleanError(err)}`);
          success = false;
        }
        return success;
      }

      for(let i = 0; i < Prov.airlineAccounts.length; i++) {
        for (let j = 0; j < 5; j++) {
          const flightCode = `F-${utils.randomStr(6)}`;
          if (await register(flightCode, Prov.airlineAccounts[i])) {
            Prov.flights.push(flightCode);
          }
        }
      }
    }
    console.log("\nRegistered flight codes:");
    console.log(await Prov.appContract.getFlightCodes());
  },

  initOracles: async () => {
    console.log("\nRegistering oracles\n");

    for(let i = 0; i < Prov.oracleAccounts.length; i++) {
      const oracleAccount = Prov.oracleAccounts[i];

      const msg = `Oracle ${oracleAccount}`;
      try {
        await Prov.appContract.registerOracle(oracleAccount, ORACLE_REGISTRATION_FEE_IN_ETH);
        console.log(`${msg}: [OK]`)
      } catch(err) {
        console.log(`${msg}: [NOK]: ${cleanError(err)}`);
      }
    }
  },
};



(async function() {

  await Prov.init();

  console.log("\nType Ctrl-C to exit.");

}());
