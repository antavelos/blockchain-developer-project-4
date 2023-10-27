import config from '../../config/config.json';
import * as utils from '../utils.js';
import AppContract from '../contracts/appContract.js';
import Web3 from 'web3';

const ORACLE_REGISTRATION_FEE = utils.ethToWei(1);

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

const Server = {
  contract: null,
  oracles: null,

  run: async () => {
    const web3 = new Web3(new Web3.providers.WebsocketProvider(config.provider.replace('http', 'ws')));

    const accounts = await web3.eth.getAccounts();
    Server.oracles = accounts.slice(20, 40);

    Server.contract = new AppContract(web3);
    Server.contract.setupEventHandlers(Server.getContractEventHandlers());

    console.log("\n\nListening to contract events...");
  },

  onFlightStatusRequested: async (data) => {
    console.log("\n\nReceived FlightStatusRequested:\n", data);

    for (let i = 0; i < Server.oracles.length; i++) {
      let indexes = await Server.contract.getMyIndexes(Server.oracles[i]);

      if (!indexes.includes(data.oracleIndex)) {
        continue;
      }

      let statusCode;
      // give STATUS_CODE_LATE_AIRLINE at least 30% higher probability
      if (utils.randomInt(10) < 3) {
        statusCode = statusCodes.STATUS_CODE_LATE_AIRLINE;
      } else {
        const statusCodesValues = Object.values(statusCodes);
        const randIdx = utils.randomInt(statusCodesValues.length)
       statusCode = statusCodesValues[randIdx];
      }

      try {
        await Server.contract.updateFlightStatus(
          data.oracleIndex,
          data.airline,
          data.flightCode,
          data.timestamp,
          statusCode,
          Server.oracles[i]
        );

        console.log(`Oracle ${i} (${indexes}) sent: ${statusCode}`)
      } catch(err) {
        console.log(`Oracle ${i} error: ${cleanError(err)}`);
      }
    }
  },
  getContractEventHandlers: () => {
    return {
      FlightStatusRequested: Server.onFlightStatusRequested,
    };
  },
  setupContractEvents: async () => {
    Server.contract.events.FlightStatusRequested({ fromBlock: "latest" }, async (error, event) => {

    });
  }
};

(async function() {

  await Server.run();

}());
