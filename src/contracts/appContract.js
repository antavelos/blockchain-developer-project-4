import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import config from '../../config/config.json';
import * as utils from '../utils.js';

export default class AppContract {
  constructor(web3) {
    this.web3 = web3;
    this.address = config.contracts.app
    this._contract = new this.web3.eth.Contract(FlightSuretyApp.abi, this.address);
    this._currentAccount = null;
  }

  setCurrentAccount(account) {
    this._currentAccount = account;
  }

  async isOperational() {
    return this._contract.methods.isOperational().call();
  }

  async getFlightCodes() {
    return this._contract.methods.getFlightCodes().call();
  }

  async getFlightData(flightCode)  {
    return this._contract.methods.getFlightData(flightCode).call()
  }

  async getFlightsData(flightCodes) {
    return Promise.all(
      flightCodes.map((fc) => this.getFlightData(fc))
    );
  }

  async getAirlineNames()  {
    return this._contract.methods.getAirlineNames().call()
  }

  async getAirlineData(airline)  {
    return this._contract.methods.getAirlineData(airline).call()
  }

  async getAirlinesData(airlineAccounts) {
    return Promise.all(
      Array.from(airlineAccounts).map((a) => this.getAirlineData(a))
    );
  }

  async getFlightInsuranceData(flightCodes) {
    return Promise.all(
      flightCodes.map((fc) => this._contract.methods.getFlightInsuranceData(this._currentAccount, fc).call())
    );
  }

  async getMyIndexes(account)  {
    return this._contract.methods.getMyIndexes().call({from: account})
  }

  async getContractData() {
    const flightCodes = await this.getFlightCodes();

    const flightsData = await this.getFlightsData(flightCodes);

    let flights = {};
    for (let i = 0; i < flightCodes.length; i++) {
      flights[flightCodes[i]] = {...flightsData[i]};
    }

    const airlineAccounts = Array.from(
      new Set(
        Object.values(flights).map(
          f => (f.airline.toLowerCase())
        )
      )
    );
    const airlinesData = await this.getAirlinesData(airlineAccounts);

    let airlines = {};
    for (let i = 0; i < airlineAccounts.length; i++) {
      airlines[airlineAccounts[i]] = {...airlinesData[i]};
    }

    const insuranceData = await this.getFlightInsuranceData(flightCodes);
    let insurances = {};
    for (let i = 0; i < flightCodes.length; i++) {
      insurances[flightCodes[i]] = {...insuranceData[i]};
    }

    return {
      flights,
      airlines,
      insurances
    };
  }

  fundAirline(amountInEth, fromAccount) {
    const account = fromAccount || this._currentAccount;

    return this._contract.methods.fundAirline().send({
      from: account,
      value: utils.ethToWei(amountInEth)
    });
  }

  registerAirline(address, name, fromAccount) {
    const account = fromAccount || this._currentAccount;

    return this._contract.methods.registerAirline(address, name).send({
      from: account,
      gas: 1000000
    })
  }

  registerFlight(flightCode, fromAccount) {
    const account = fromAccount || this._currentAccount;

    return this._contract.methods.registerFlight(flightCode).send({
      from: account,
      gas: 1000000
    })
  }

  buyInsurance(flightCode, amountInEth, fromAccount) {
    const account = fromAccount || this._currentAccount;

    return this._contract.methods.buyInsurance(flightCode).send({
      from: account,
      value: utils.ethToWei(amountInEth)
    })
  }

  withdrawRefund(flightCode, fromAccount) {
    const account = fromAccount || this._currentAccount;

    return this._contract.methods.withdrawInsuranceRefund(flightCode).send({
      from: account
    })
  }

  fetchFlightStatus(flightCode, timestamp, fromAccount) {
    const account = fromAccount || this._currentAccount;

    return this._contract.methods.fetchFlightStatus(flightCode, timestamp).send({
      from: account
    })
  }

  updateFlightStatus(oracleIndex, airline, flightCode, timestamp, statusCode, fromAccount) {
    const account = fromAccount || this._currentAccount;

    return this._contract.methods.updateFlightStatus(
      oracleIndex,
      airline,
      flightCode,
      timestamp,
      statusCode
    )
    .send({from: account, gas: 1000000});
  }

  registerOracle(account, amountInEth) {
    return this._contract.methods.registerOracle().send({
      from: account,
      value: utils.ethToWei(amountInEth),
      gas: 1000000
    });
  }

  setupEventHandlers(handlers) {
    Object.keys(handlers).forEach(eventName => {
      this._contract.events[eventName]((error, event) => {
        const data = event.returnValues;
        console.log(`Received ${eventName}:`, data)
        handlers[eventName](data);
      })
    })
  }
}
