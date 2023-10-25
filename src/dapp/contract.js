import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import config from './config.json';
import * as utils from '../utils.js';

export default class Contract {
  constructor(web3) {
    this.web3 = web3;
    this._contract = new this.web3.eth.Contract(FlightSuretyApp.abi, config.contracts.app);
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
  async getAirlinesData(airlineAccounts) {
    return Promise.all(
      Array.from(airlineAccounts).map((a) => this._contract.methods.getAirlineData(a).call())
    );
  }

  async getFlightInsuranceData(flightCodes) {
    console.log()
    return Promise.all(
      flightCodes.map((fc) => this._contract.methods.getFlightInsuranceData(this._currentAccount, fc).call())
    );
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

  fundAirline(amountInEth) {
    return this._contract.methods.fundAirline().send({
      from: this._currentAccount,
      value: utils.ethToWei(amountInEth)
    });
  }

  registerAirline(address, name) {
    return this._contract.methods.registerAirline(address, name).send({
      from: this._currentAccount
    })
  }

  registerFlight(flightCode) {
    return this._contract.methods.registerFlight(flightCode).send({
      from: this._currentAccount
    })
  }

  buyInsurance(flightCode, amountInEth) {
    return this._contract.methods.buyInsurance(flightCode).send({
      from: this._currentAccount,
      value: utils.ethToWei(amountInEth)
    })
  }

  withdrawRefund(flightCode) {
    return this._contract.methods.withdrawInsuranceRefund(flightCode).send({
      from: this._currentAccount
    })
  }

  fetchFlightStatus(flightCode, timestmap) {
    return this._contract.methods.fetchFlightStatus(flightCode, timestmap).send({
      from: this._currentAccount
    })
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
