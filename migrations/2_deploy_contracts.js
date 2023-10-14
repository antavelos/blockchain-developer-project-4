const FlightSuretyApp = artifacts.require("FlightSuretyApp");
const FlightSuretyData = artifacts.require("FlightSuretyData");
const fs = require('fs');

const saveConfig = (config, path) => fs.writeFileSync(`${__dirname}/${path}`, JSON.stringify(config, null, '\t'), 'utf-8');


module.exports = async (deployer) => {

    const firstAirlineAccount = '0xf17f52151EbEF6C7334FAD080c5704D77216b732';
    const firstAirlineName = 'First';

    await deployer.deploy(FlightSuretyData, firstAirlineAccount, firstAirlineName);
    await deployer.deploy(FlightSuretyApp, FlightSuretyData.address);

    const config = {
      localhost: {
        url: 'http://localhost:8545',
        dataAddress: FlightSuretyData.address,
        appAddress: FlightSuretyApp.address
      }
    };

    [
      '../src/dapp/config.json',
      '../src/server/config.json'
    ]
      .forEach(path => saveConfig(config, path));
}