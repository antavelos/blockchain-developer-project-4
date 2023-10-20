
const Config = require('./testConfig.js');
const utils = require('../src/utils.js');

contract('Oracles', async (accounts) => {

  const ORACLE_REGISTRATION_FEE = utils.ethToWei(1);
  const ORACLE_INDEXES_COUNT = 3;

  // Watch contract events
  const STATUS_CODE_UNKNOWN = 0;
  const STATUS_CODE_ON_TIME = 10;
  const STATUS_CODE_LATE_AIRLINE = 20;
  const STATUS_CODE_LATE_WEATHER = 30;
  const STATUS_CODE_LATE_TECHNICAL = 40;
  const STATUS_CODE_LATE_OTHER = 50;

  let config;
  before('setup contract', async () => {
    config = await Config.init(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address, {from: config.owner});
    await config.flightSuretyData.authorizeCaller(config.owner, {from: config.owner});
  });

  it('FlightSuretyApp.registerOracle() should fail when contract is not operational', async () => {
    const oracleAccount = config.oracles[0]

    await config.flightSuretyApp.setOperatingStatus(false);

    await utils.assertContractCallError(
      config.flightSuretyApp.registerOracle({from: oracleAccount, value: ORACLE_REGISTRATION_FEE}),
      "Contract is not currently operational"
    )

    // make contract operational again
    await config.flightSuretyApp.setOperatingStatus(true);
  });

  it('FlightSuretyApp.registerOracle() should fail when registration fee is not sufficient', async () => {
    const oracleAccount = config.oracles[0]

    await utils.assertContractCallError(
      config.flightSuretyApp.registerOracle({from: oracleAccount, value: 0}),
      "Insufficient registration fee"
    )
  });

  it('FlightSuretyApp.registerOracle() should fail when oracle is already registered', async () => {
    const oracleAccount = config.oracles[0]

    await config.flightSuretyApp.registerOracle({from: oracleAccount, value: ORACLE_REGISTRATION_FEE}),

    await utils.assertContractCallError(
      config.flightSuretyApp.registerOracle({from: oracleAccount, value: ORACLE_REGISTRATION_FEE}),
      "Oracle is already registered"
    )
  });

  it('FlightSuretyApp.registerOracle() should gerister an oracle', async () => {
    for(let i = 1; i < config.oracles.length; i++) {
      const oracleAccount = config.oracles[i];

      await config.flightSuretyApp.registerOracle({from: oracleAccount, value: ORACLE_REGISTRATION_FEE});

      let indexes = await config.flightSuretyApp.getMyIndexes({from: oracleAccount});

      assert.equal(indexes.length, ORACLE_INDEXES_COUNT, `Not enough indexes`);
    }
  });

  it('FlightSuretyApp.fetchFlightStatus() should fail when contract is not operational', async () => {
    const airlineAccount = config.airlines[0].account;
    const flightCode = 'ND1309';
    const timestamp = utils.now();

    await config.flightSuretyApp.setOperatingStatus(false);

    await utils.assertContractCallError(
      config.flightSuretyApp.fetchFlightStatus(flightCode, timestamp),
      "Contract is not currently operational"
    )

    // make contract operational again
    await config.flightSuretyApp.setOperatingStatus(true);
  });

  it('FlightSuretyApp.fetchFlightStatus() should fail when flight is not registered', async () => {
    const flightCode = 'ND1309';
    const timestamp = utils.now();

    await utils.assertContractCallError(
      config.flightSuretyApp.fetchFlightStatus(flightCode, timestamp),
      "Flight is not registered"
    )

  });

  it('FlightSuretyApp.fetchFlightStatus() should broadcast relevant event', async () => {
    const airlineAccount = config.airlines[0].account;
    const flightCode = 'ND1309';
    const timestamp = utils.now();

    await config.flightSuretyApp.registerFlight(flightCode, {from: airlineAccount});

    await config.flightSuretyApp.fetchFlightStatus(flightCode, timestamp);

    const events = await config.flightSuretyApp.getPastEvents('FlightStatusRequested');
    assert.equal(events.length, 1);
    assert.equal(events[0].logIndex, 0);
    assert.equal(events[0].returnValues.airline, airlineAccount, "Airline does not match in broadcasted event");
    assert.equal(events[0].returnValues.flightCode, flightCode, "Flight code does not match in broadcasted event");
    assert.equal(events[0].returnValues.timestamp, timestamp.toString(), "Timestmap does not match in broadcasted event");
  });


  it('FlightSuretyApp.updateFlightStatus() should fail when contract is not operational', async () => {
    const index = 0;
    const airline = config.airlines[0].account;
    const flightCode = 'ND1309';
    const timestamp = utils.now();
    const statusCode = STATUS_CODE_ON_TIME;

    await config.flightSuretyApp.setOperatingStatus(false);

    await utils.assertContractCallError(
      config.flightSuretyApp.updateFlightStatus(index, airline, flightCode, timestamp, statusCode),
      "Contract is not currently operational"
    )

    // make contract operational again
    await config.flightSuretyApp.setOperatingStatus(true);
  });

  it('FlightSuretyApp.updateFlightStatus() should fail when oracle index is not correct', async () => {
    const oracle = config.oracles[0];
    const airline = config.airlines[0].account;
    const flightCode = 'ND1309';
    const timestamp = utils.now();
    const statusCode = STATUS_CODE_ON_TIME;

    await config.flightSuretyApp.fetchFlightStatus(flightCode, timestamp);

    const indexes = (await config.flightSuretyApp.getMyIndexes({from: oracle})).map((bn) => bn.toNumber());

    let invalidIndex;
    for (let i = 0; i < 10; i++) {
      invalidIndex = i;
      if (!indexes.includes(invalidIndex)) {
        break;
      }
    }

    await utils.assertContractCallError(
      config.flightSuretyApp.updateFlightStatus(invalidIndex, airline, flightCode, timestamp, statusCode, {from: oracle}),
      "Oracle index mismatch"
    )
  });

  it('FlightSuretyApp.updateFlightStatus() should fail when parameters do not match any registered request', async () => {
    const airlineAccount = config.airlines[0].account;
    const oracle = config.oracles[0];
    const invalidFlightCode = 'invalid';
    const statusCode = STATUS_CODE_ON_TIME;
    const flightCode = 'ND1310';
    const timestamp = utils.now();

    await config.flightSuretyApp.registerFlight(flightCode, {from: airlineAccount});

    await config.flightSuretyApp.fetchFlightStatus(flightCode, timestamp);

    const indexes = (await config.flightSuretyApp.getMyIndexes({from: oracle})).map((bn) => bn.toNumber());

    await utils.assertContractCallError(
      config.flightSuretyApp.updateFlightStatus(indexes[0], airlineAccount, invalidFlightCode, timestamp, statusCode, {from: oracle}),
      "Invalid parameters"
    )
  });

  it('FlightSuretyApp.updateFlightStatus() should should raise relevant events', async () => {
    const airlineAccount = config.airlines[0].account;
    const flightCode = 'ND1311';
    const timestamp = utils.now();
    const statusCode = STATUS_CODE_ON_TIME;

    await config.flightSuretyApp.registerFlight(flightCode, {from: airlineAccount});

    await config.flightSuretyApp.fetchFlightStatus(flightCode, timestamp);

    const requestEvent = (await config.flightSuretyApp.getPastEvents('FlightStatusRequested'))[0];
    const index = requestEvent.returnValues.oracleIndex;

    let events = []
    for (let i = 0; i < config.oracles.length; i++) {
      const indexes = await config.flightSuretyApp.getMyIndexes({from: config.oracles[i]});

      for (let j = 0; j < indexes.length; j++) {
        if (indexes[j] != index) continue;

        try {
          await config.flightSuretyApp.updateFlightStatus(indexes[j], airlineAccount, flightCode, timestamp, statusCode, {from: config.oracles[i]});
          const statusEvents = await config.flightSuretyApp.getPastEvents('FlightStatusReceived');
          events.push(statusEvents[0]);
          // console.log(`Oracle (${i}, ${indexes[j]}): ${events[0].returnValues.verified}`);

        } catch(err) {}
      }
    }
    assert.equal(events.length, 3, "There should be 3 events");
    for (let i = 0; i < events.length; i++) {
      assert.equal(events[i].returnValues.airline, airlineAccount, "Airline does not match");
      assert.equal(events[i].returnValues.flightCode, flightCode, "Flight code does not match");
      assert.equal(events[i].returnValues.timestamp, timestamp.toString(), "Timestamp does not match");
      assert.equal(events[i].returnValues.statusCode, statusCode, "Status code does not match");
    }
    assert.isFalse(events[0].returnValues.verified, "First status code should not be verified");
    assert.isFalse(events[1].returnValues.verified, "Second status code should not be verified");
    assert.isTrue(events[2].returnValues.verified, "Third status code should be verified");
  });

  it('FlightSuretyApp.updateFlightStatus() should refund passenger for delayed flight', async () => {
    const airlineAccount = config.airlines[0].account;
    const passenger = config.passenger;
    const insuranceAmount = utils.ethToWei(1);
    const flightCode = 'ND1312';
    const timestamp = utils.now();
    const statusCode = STATUS_CODE_LATE_AIRLINE;

    await config.flightSuretyApp.registerFlight(flightCode, {from: airlineAccount});

    await config.flightSuretyApp.buyInsurance(flightCode, {from: passenger, value: insuranceAmount});

    let insuranceData = await config.flightSuretyData.getFlightInsuranceData(passenger, flightCode);
    assert.equal(insuranceData.refundAmount, 0);

    await config.flightSuretyApp.fetchFlightStatus(flightCode, timestamp);

    const requestEvent = (await config.flightSuretyApp.getPastEvents('FlightStatusRequested'))[0];
    const index = requestEvent.returnValues.oracleIndex;

    let refundEvents = [];
    for (let i = 0; i < config.oracles.length; i++) {
      const indexes = (await config.flightSuretyApp.getMyIndexes({from: config.oracles[i]})).map((i) => i.toNumber());
      for (let j = 0; j < indexes.length; j++) {
        if (indexes[j] == index) {
          try {
            await config.flightSuretyApp.updateFlightStatus(indexes[j], airlineAccount, flightCode, timestamp, statusCode, {from: config.oracles[i]});
            const events = await config.flightSuretyApp.getPastEvents('FlightInsuranceRefundCredited');
            if (events.length > 0) {
              refundEvents.push(events[0]);
            };
          } catch(err) {}
        }
      }
    }

    insuranceData = await config.flightSuretyData.getFlightInsuranceData(passenger, flightCode);
    assert.isTrue(insuranceData.refundAmount > 0, "refund amount was not credited");

    assert.equal(refundEvents.length, 1, "There should be one flight insurance refund credited event")
    assert.equal(refundEvents[0].returnValues.passenger, passenger, "passenger does not match");
    assert.equal(refundEvents[0].returnValues.flightCode, flightCode, "flightCode does not match");
  });
});
