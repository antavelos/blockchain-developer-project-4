import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import config from '../../config/config.json';

export default class DataContract {
  constructor(web3) {
    this.web3 = web3;
    this.address = config.contracts.data
    this._contract = new this.web3.eth.Contract(FlightSuretyData.abi, this.address);
    this._currentAccount = null;
  }

  setCurrentAccount(account) {
    this._currentAccount = account;
  }

  authorizeCaller(caller, fromAccount) {
    const account = fromAccount || this._currentAccount;

    return this._contract.methods.authorizeCaller(caller).send({
      from: account
    })
  }
}
