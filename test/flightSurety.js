
const Config = require('./testConfig.js');
const web3 = require('web3');
const utils = require('../src/utils.js');


contract('Flight Surety Tests', async (accounts) => {

  const w3 = new web3('http://localhost:8545');

  let config = {};
  before('setup contract', async () => {
    config = await Config.init(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address, {from: config.owner});
    await config.flightSuretyData.authorizeCaller(config.owner, {from: config.owner});
  });

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`should have initial operational status: 'true'`, async function () {
    const status = await config.flightSuretyApp.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");
  });

  it(`should not allow non-Contract Owner accounts to change the operational status`, async () => {
    const statusBefore = await config.flightSuretyApp.isOperational.call();

    await utils.assertContractCallError(
      config.flightSuretyApp.setOperatingStatus(!statusBefore, { from: config.testAddresses[2] }),
      "Caller is not contract owner"
    )

    const statusAfter = await config.flightSuretyApp.isOperational.call();

    assert.equal(statusBefore, statusAfter, "Status should not have changed");

  });

  it(`should allow Contract Owner account to change the operational status`, async () => {

    const statusBefore = await config.flightSuretyApp.isOperational.call();

    await config.flightSuretyApp.setOperatingStatus(!statusBefore, {from: config.owner});

    const statusAfter = await config.flightSuretyApp.isOperational.call();

    assert.notEqual(statusBefore, statusAfter, "Status should have changed");

  });

  /****************************************************************************************/
  /* Airlines                                                                             */
  /****************************************************************************************/

  it('should register first airline upon deployment', async () => {
    const airlinesCount = await config.flightSuretyData.getAirlinesCount();

    assert.equal(airlinesCount, 1, 'No airlines were registered upon deployment');

    const data = await config.flightSuretyData.getAirlineData(config.airlines[0].account);
    assert.equal(data.name, config.airlines[0].name, 'First airline name does not match');
    assert.isFalse(data.hasFunded, 'First airline should not have provided funding yet');
  });

  it('FlightSuretyData.getAirlineData() should fail when called by unauthorized caller', async () => {
    await utils.assertContractCallError(
      config.flightSuretyData.getAirlineData(config.airlines[0].account, {from: config.testAddresses[0]}),
      "Caller is not authorized"
    )
  });

  it('FlightSuretyData.getAirlineData() should return the requested airline', async () => {
    const data = await config.flightSuretyData.getAirlineData(config.airlines[0].account);

    assert.equal(data.name, config.airlines[0].name, 'First airline name does not match');
    assert.isFalse(data.hasFunded, 'First airline should not have provided funding yet');
  });

  it('FlightSuretyData.getAirlineNames() should fail when called by unauthorized caller', async () => {
    await utils.assertContractCallError(
      config.flightSuretyData.getAirlineNames({from: config.testAddresses[0]}),
      "Caller is not authorized"
    )
  });

  it('FlightSuretyData.getAirlineNames() should return all the airlines', async () => {
    const airlines = await config.flightSuretyData.getAirlineNames();

    assert.equal(airlines.length, 1, 'No airlines were found');
  });

  it('FlightSuretyData.addAirline() should fail when called by unauthorized caller', async () => {
    await utils.assertContractCallError(
      config.flightSuretyData.addAirline(config.testAddresses[0], 'Airline', {from: config.testAddresses[1]}),
      "Caller is not authorized"
    )
  });

  it('FlightSuretyData.addAirline() should add a new airline', async () => {
    const airline = {
      account: config.airlines[1].account,
      name: config.airlines[1].name,
      funding: 0
    }

    await config.flightSuretyData.addAirline(airline.account, airline.name);

    const airlinesCount = await config.flightSuretyData.getAirlinesCount();

    assert.equal(airlinesCount, 2, '2 airlines should be registered');

    const data = await config.flightSuretyData.getAirlineData(airline.account);

    assert.equal(data.name, airline.name, 'Second airline name does not match');
    assert.isFalse(data.hasFunded, 'Second airline should not have provided funding yet');
  });

  it('FlightSuretyData.setAirlineFunded() should fail when called by unauthorized caller', async () => {
    await utils.assertContractCallError(
      config.flightSuretyData.setAirlineFunded(config.airlines[0].account, {from: config.testAddresses[1]}),
      "Caller is not authorized"
    )
  });

  it('FlightSuretyData.setAirlineFunded() should update the airline funding', async () => {
    await config.flightSuretyData.setAirlineFunded(config.airlines[0].account);

    airline = await config.flightSuretyData.getAirlineData(config.airlines[0].account);

    assert.isTrue(airline.hasFunded, "Airline should have been set as funded");
  });

  it('FlightSuretyApp.fundAirline() should fail if called by not registered airline', async () => {
    const amount = utils.ethToWei(1);
    await utils.assertContractCallError(
      config.flightSuretyApp.fundAirline({from: config.testAddresses[1], value: amount}),
      "Caller is not a registered airline"
    )
  });

  it('FlightSuretyApp.fundAirline() should update the airline funding', async () => {
    const funding = utils.ethToWei(10);
    await config.flightSuretyApp.fundAirline({from: config.airlines[0].account, value: funding});

    airline = await config.flightSuretyData.getAirlineData(config.airlines[0].account);

    assert.isTrue(airline.hasFunded, "Airline should have been set as funded");
  });

  it('FlightSuretyApp.registerAirline() should fail when contract is not operational', async () => {
    const airline = {
      account: config.airlines[2].account,
      name: config.airlines[2].name,
      funding: 0
    }

    await config.flightSuretyApp.setOperatingStatus(false);
    await utils.assertContractCallError(
      config.flightSuretyApp.registerAirline(airline.account, airline.name),
      "Contract is not currently operational"
    )

    // make contract operational again
    await config.flightSuretyApp.setOperatingStatus(true);
  });

  it('FlightSuretyApp.registerAirline() should fail when calling account is not registered airline', async () => {
    const airline = {
      account: config.airlines[2].account,
      name: config.airlines[2].name,
      funding: 0
    }
    await utils.assertContractCallError(
      config.flightSuretyApp.registerAirline(airline.account, airline.name, {from: config.testAddresses[5]}),
      "Caller is not a registered airline"
    )
  });

  it('FlightSuretyApp.registerAirline() should fail when calling account has not funded enough', async () => {
    const airline = {
      account: config.airlines[2].account,
      name: config.airlines[2].name,
      funding: 0
    }
    await utils.assertContractCallError(
      config.flightSuretyApp.registerAirline(airline.account, airline.name, {from: config.airlines[1].account}),
      "Caller has not submitted sufficient funding yet"
    )
  });

  it('FlightSuretyApp.registerAirline() should fail when new airline is already registered', async () => {
    const airline = {
      account: config.airlines[0].account,
      name: config.airlines[0].name,
      funding: 0
    }
    await config.flightSuretyApp.fundAirline({from: config.airlines[0].account, value: utils.ethToWei(10)});
    await utils.assertContractCallError(
      config.flightSuretyApp.registerAirline(airline.account, airline.name, {from: config.airlines[0].account}),
      "Airline is already registered"
    )
  });

  it('FlightSuretyApp.registerAirline() new airline should be registered when existing airlines are < 4', async () => {
    const airline = {
      account: config.airlines[2].account,
      name: config.airlines[2].name,
      funding: 0
    }

    const currentAirlinesNum = parseInt(await config.flightSuretyData.getAirlinesCount());
    assert.isTrue(currentAirlinesNum < 5, "current number of airlines is >= 5");

    await config.flightSuretyApp.registerAirline(airline.account, airline.name, {from: config.airlines[0].account});

    const airlinesCount = await config.flightSuretyData.getAirlinesCount();
    assert.equal(airlinesCount, currentAirlinesNum + 1, "new airline was not registered");
  });

  it('FlightSuretyApp.registerAirline() new airline requires consensus when existing airlines are >= 4', async () => {
    const fourthAirline = {
      account: config.testAddresses[2],
      name: 'Fourth Airline',
      funding: 0
    }

    // register a fourth airline in order to continue with concesus
    await config.flightSuretyApp.registerAirline(fourthAirline.account, fourthAirline.name, {from: config.airlines[0].account});
    const airlinesCountBefore = (await config.flightSuretyData.getAirlinesCount()).toNumber();
    assert.isTrue(airlinesCountBefore === 4, "current number of airlines is not 4");

    const fifthAirline = {
      account: config.testAddresses[3],
      name: 'Fifth Airline',
      funding: 0
    }

    // first attempt should get 25% concensus
    await config.flightSuretyApp.fundAirline({from: config.airlines[0].account, value: utils.ethToWei(10)});
    await config.flightSuretyApp.registerAirline(fifthAirline.account, fifthAirline.name, {from: config.airlines[0].account});

    let airlinesCountAfter = await config.flightSuretyData.getAirlinesCount();
    assert.equal(airlinesCountAfter, airlinesCountBefore, "new airline should not be registered yet");

    // prevent revoting
    await utils.assertContractCallError(
      config.flightSuretyApp.registerAirline(fifthAirline.account, fifthAirline.name, {from: config.airlines[0].account}),
      "Caller has alredy voted for the candidate airline"
    )

    // first attempt should get 50% concensus
    await config.flightSuretyApp.fundAirline({from: config.airlines[1].account, value: utils.ethToWei(10)});
    await config.flightSuretyApp.registerAirline(fifthAirline.account, fifthAirline.name, {from: config.airlines[1].account});

    airlinesCountAfter = await config.flightSuretyData.getAirlinesCount();
    assert.equal(airlinesCountAfter, airlinesCountBefore + 1, "new airline should have been registered");
  });

  it('FlightSuretyData.addFlight() should fail when called from unauthorized caller', async () => {
    const flightCode = "ND1309";
    const airline = config.airlines[0].account;

    await utils.assertContractCallError(
      config.flightSuretyData.addFlight(airline, flightCode, {from: config.testAddresses[1]}),
      "Caller is not authorized"
    )
  });

  it('FlightSuretyData.addFlight() should add a new flight', async () => {
    const flightCode = "ND1309";
    const airline = config.airlines[0].account;

    await config.flightSuretyData.addFlight(airline, flightCode);

    const flight = await config.flightSuretyData.getFlightData(flightCode);
    assert.equal(flight.airline, airline, "flight insurance doesn't match");
    assert.equal(flight.statusCode, 0, "initial flight status code should be 0");
  });

  it('FlightSuretyData.updateFlight() should fail when called from unauthorized caller', async () => {
    const flightCode = "ND1309";
    const statusCode = 1;

    await utils.assertContractCallError(
      config.flightSuretyData.updateFlight(flightCode, statusCode, true, {from: config.testAddresses[1]}),
      "Caller is not authorized"
    )
  });

  it('FlightSuretyData.updateFlight() should update a flight', async () => {
    const flightCode = "ND9999";
    const airline = config.airlines[0].account;

    await config.flightSuretyData.addFlight(airline, flightCode);

    const newStatusCode = 1;
    await config.flightSuretyData.updateFlight(flightCode, newStatusCode, true);

    const flight = await config.flightSuretyData.getFlightData(flightCode);
    assert.equal(flight.statusCode, newStatusCode, "status code was not updated");
    assert.isTrue(flight.statusCodeVerified, "status code was not updated");
  });

  it('FlightSuretyApp.registerFlight() should fail when contract is not operational', async () => {
    const flightCode = "ND1309";
    const airline = config.airlines[0].account;

    await config.flightSuretyApp.setOperatingStatus(false);

    await utils.assertContractCallError(
      config.flightSuretyApp.registerFlight(flightCode, {from: airline}),
      "Contract is not currently operational"
    )

    // make contract operational again
    await config.flightSuretyApp.setOperatingStatus(true);
  });

  it('FlightSuretyApp.registerFlight() should fail when caller is not a registered airline', async () => {
    const flightCode = "ND1309";
    const airline = config.testAddresses[9];

    await utils.assertContractCallError(
      config.flightSuretyApp.registerFlight(flightCode, {from: airline}),
      "Caller is not a registered airline"
    )
  });

  it('FlightSuretyApp.registerFlight() should fail when flight is already registered', async () => {
    const flightCode = "ND1309";
    const airline = config.airlines[0].account;

    await config.flightSuretyData.addFlight(airline, flightCode);

    await utils.assertContractCallError(
      config.flightSuretyApp.registerFlight(flightCode, {from: airline}),
      "Flight is already registered"
    )
  });

  it('FlightSuretyApp.registerFlight() should register a flight', async () => {
    const flightCode = "ND1310";
    const airline = config.airlines[0].account;

    await config.flightSuretyApp.registerFlight(flightCode, {from: airline});

    const data = await config.flightSuretyData.getFlightData(flightCode);
    assert.equal(data.airline, airline, "flight airline doesn't match");
    assert.equal(data.statusCode, 0, "initial flight code should be 0");
  });

  it('FlightSuretyData.addFlightInsurance() should fail when called from unauthorized caller', async () => {
    const flightCode = "ND1309";
    const amount = utils.ethToWei(1);
    const passenger = config.passenger;

    await utils.assertContractCallError(
      config.flightSuretyData.addFlightInsurance(passenger, flightCode, amount, {from: config.testAddresses[1]}),
      "Caller is not authorized"
    )
  });

  it('FlightSuretyData.addFlightInsurance() should add a new insurance', async () => {
    const flightCode = "ND1309";
    const amount = utils.ethToWei(1);
    const passenger = config.passenger;

    await config.flightSuretyData.addFlightInsurance(passenger, flightCode, amount);

    const insurance = await config.flightSuretyData.getFlightInsuranceData(passenger, flightCode);
    assert.equal(insurance.amount, amount, "insurance amount doesn't match");
    assert.equal(insurance.refundAmount, 0, "insurance refund amount should be 0");
  });

  it('FlightSuretyData.updateFlightInsuranceData() should fail when called from unauthorized caller', async () => {
    const flightCode = "ND1309";
    const passenger = config.passenger;

    await utils.assertContractCallError(
      config.flightSuretyData.updateFlightInsuranceData(
        passenger,
        flightCode,
        {
          amount: utils.ethToWei(1),
          refundAmount: utils.ethToWei(1.5),
          refundWithdrawn: false
        },
        {
          from: config.testAddresses[1]
        }
      ),
      "Caller is not authorized"
    )
  });

  it('FlightSuretyData.updateFlightInsuranceData() should set the refund amount', async () => {
    const flightCode = "ND1309";
    const amount = utils.ethToWei(1);
    const passenger = config.passenger;

    const refundAmount = utils.ethToWei(1.5);

    await config.flightSuretyData.addFlightInsurance(passenger, flightCode, utils.ethToWei(1));

    const updated = {
      amount,
      refundAmount: utils.ethToWei(1.5),
      refundWithdrawn: false
    };

    await config.flightSuretyData.updateFlightInsuranceData(passenger, flightCode, updated);

    const insurance = await config.flightSuretyData.getFlightInsuranceData(passenger, flightCode);
    assert.equal(insurance.amount, amount, "insurance amount doesn't match");
    assert.equal(insurance.refundAmount, refundAmount, "insurance refund amount doesn't match");
    assert.isFalse(insurance.refundWithdrawn, "Refund should not have been withdrawn");
  });

  it('FlightSuretyApp.buyInsurance() should fail when contract is not operational', async () => {
    const flightCode = "ND1309";
    const amount = utils.ethToWei(1);
    const passenger = config.passenger;

    await config.flightSuretyApp.setOperatingStatus(false);

    await utils.assertContractCallError(
      config.flightSuretyApp.buyInsurance(flightCode, {from: passenger, value: amount}),
      "Contract is not currently operational"
    )

    // make contract operational again
    await config.flightSuretyApp.setOperatingStatus(true);
  });

  it('FlightSuretyApp.buyInsurance() should fail when flight is not registered', async () => {
    const flightCode = "ND1399";
    const amount = utils.ethToWei(1);
    const passenger = config.passenger;

    await utils.assertContractCallError(
      config.flightSuretyApp.buyInsurance(flightCode, {from: passenger, value: amount}),
      "Flight is not registered"
    )
  });

  it('FlightSuretyApp.buyInsurance() should fail when amount is above 1 ETH', async () => {
    const flightCode = "ND1311";
    const amount = utils.ethToWei(2);
    const passenger = config.passenger;

    await config.flightSuretyApp.registerFlight(flightCode, {from: config.airlines[0].account})

    await utils.assertContractCallError(
      config.flightSuretyApp.buyInsurance(flightCode, {from: passenger, value: amount}),
      "Max insurance amount is 1 ETH"
    )
  });

  it('FlightSuretyApp.buyInsurance() should register a new insurance', async () => {
    const flightCode = "ND1312";
    const amount = utils.ethToWei(1);
    const passenger = config.passenger;

    await config.flightSuretyApp.registerFlight(flightCode, {from: config.airlines[0].account})

    await config.flightSuretyApp.buyInsurance(flightCode, {from: passenger, value: amount});

    const data = await config.flightSuretyData.getFlightInsuranceData(passenger, flightCode);
    assert.equal(data.amount, amount, "insurance amount doesn't match");
    assert.equal(data.refundAmount, 0, "insurance refund amount should be 0");
  });

  it('FlightSuretyApp.withdrawInsuranceRefund() should fail when contract is not operational', async () => {
    const flightCode = "ND1309";
    const passenger = config.passenger;

    await config.flightSuretyApp.setOperatingStatus(false);

    await utils.assertContractCallError(
      config.flightSuretyApp.withdrawInsuranceRefund(flightCode, {from: passenger}),
      "Contract is not currently operational"
    )

    // make contract operational again
    await config.flightSuretyApp.setOperatingStatus(true);
  });

  it('FlightSuretyApp.withdrawInsuranceRefund() should fail when flight is not registered', async () => {
    const flightCode = "ND1399";
    const passenger = config.passenger;

    await utils.assertContractCallError(
      config.flightSuretyApp.withdrawInsuranceRefund(flightCode, {from: passenger}),
      "Flight is not registered"
    )
  });

  it('FlightSuretyApp.withdrawInsuranceRefund() should fail when no refund has been issued', async () => {
    const flightCode = "ND1314";
    const amount = utils.ethToWei(1);
    const passenger = config.passenger;

    // setup
    await config.flightSuretyApp.registerFlight(flightCode, {from: config.airlines[0].account});
    await config.flightSuretyApp.buyInsurance(flightCode, {from: passenger, value: amount});

    await utils.assertContractCallError(
      config.flightSuretyApp.withdrawInsuranceRefund(flightCode, {from: passenger}),
      "No refund has been issued yet"
    )
  });

  it('FlightSuretyApp.withdrawInsuranceRefund() passenger should be refunded', async () => {
    const flightCode = "ND1315";
    const amount = utils.ethToWei(1);
    const refundAmount = utils.ethToWei(2);
    const passenger = config.passenger;

    // setup
    await config.flightSuretyApp.registerFlight(flightCode, {from: config.airlines[0].account});
    await config.flightSuretyApp.buyInsurance(flightCode, {from: passenger, value: amount});
    await config.flightSuretyData.updateFlightInsuranceData(passenger, flightCode, {
      amount,
      refundAmount,
      refundWithdrawn: false
    })

    const balanceBefore = parseInt(await w3.eth.getBalance(passenger));

    await config.flightSuretyApp.withdrawInsuranceRefund(flightCode, {from: passenger, gasPrice: 0});

    const balanceAfter = parseInt(await w3.eth.getBalance(passenger));
    assert.equal(balanceAfter - balanceBefore, parseInt(refundAmount), "New balance does not match");

    const data = await config.flightSuretyData.getFlightInsuranceData(passenger, flightCode)
    assert.equal(data.refundAmount, 0, "Refund amount was not adjusted");
    assert.isTrue(data.refundWithdrawn, "Refund should have been withdrawn");
  });
});