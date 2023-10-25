import config from './config.json';
import Contract from './contract';
import UI from './ui';
import * as utils from '../utils.js';
import DOM from './dom';
import Web3 from "web3";
import moment from "moment";

window.addEventListener("load", async () => {
  App.metamask = window.ethereum;

  const web3 = App.metamask
    ? new Web3(window.ethereum)
    : new Web3(new Web3.providers.WebsocketProvider(config.provider.replace('http', 'ws')));

  await App.start(web3);
});

const App = {
  metamask: null,
  ui: null,
  contract: null,
  currentAccount: null,
  flightsListEl: DOM.elid("flights-list"),
  flights: {},
  airlines: {},
  insurances: {},

  statusCodes: {
    STATUS_CODE_UNKNOWN: 0,
    STATUS_CODE_ON_TIME: 10,
    STATUS_CODE_LATE_AIRLINE: 20,
    STATUS_CODE_LATE_WEATHER: 30,
    STATUS_CODE_LATE_TECHNICAL: 40,
    STATUS_CODE_LATE_OTHER: 50,
  },

  start: async (web3) => {
    App.currentAccount = await App.getFirstAccount(web3);

    App.contract = new Contract(web3);
    App.contract.setCurrentAccount(App.currentAccount);
    App.contract.setupEventHandlers(App.getContractEventHandlers());

    if (App.metamask) {
      App.setupMetamaskEvents()
    }

    App.ui = new UI("flights-list");

    await App.updateDom();
  },
  getFirstAccount:async (web3) => {
    const accounts = await web3.eth.getAccounts();
    return accounts[0].toLowerCase();
  },
  onMetamaskAccountChange: async (accounts) => {
    const firstAccount = accounts[0].toLowerCase();

    App.currentAccount = firstAccount;
    App.contract.setCurrentAccount(firstAccount);
    console.log('Account changed: ', firstAccount);

    await App.updateDom();
  },
  setupMetamaskEvents() {
    App.metamask.on('accountsChanged', App.onMetamaskAccountChange);
  },
  updateDom: async () => {
    const isOperational = await App.contract.isOperational();

    if (!isOperational) {
      App.ui.setNotOperational();
      return;
    }

    App.ui.setOperational();

    App.ui.hideActionsMenu();
    App.ui.renderSpinner();
    await App.syncContractData();
    App.renderDom();
  },
  syncContractData: async () => {
    const contractData = await App.contract.getContractData();

    App.flights = contractData.flights;
    App.airlines = contractData.airlines;
    App.insurances = contractData.insurances;
  },
  displayError: (err, msg) => {
    App.ui.showErrorToast(msg);
    console.error(err);
  },
  fundAirline: () => {
    const amount = parseInt(App.ui.$fundAirlineAmount.value);

    App.contract.fundAirline(amount)
    .then(() => {
      App.ui.fundAirlineModal.hide();
      App.ui.showSuccessToast("Your funding was submitted successfully");
      App.airlines[App.currentAccount].hasFunded = true;
      App.renderDom();
    })
    .catch(err => {
      App.ui.fundAirlineModal.hide();
      App.displayError(err, "Failed submit funding");
    })
  },
  registerAirline: () => {
    const address = App.ui.$registerAirlineAddress.value;
    const name = App.ui.$registerAirlineName.value;

    App.contract.registerAirline(address, name)
    .then(() => {
      App.ui.registerAirlineModal.hide();
      App.ui.showSuccessToast("Your vote has been registered");
    })
    .catch(err => {
      App.ui.registerAirlineModal.hide();
      App.displayError(err, `Failed to vote for new airline: ${utils.cleanError(err)}`);
    });
  },
  registerFlight: () => {
    const flightCode = App.ui.$registerFlightCode.value;

    App.contract.registerFlight(flightCode)
    .then(() => {
      App.ui.registerFlightModal.hide();
      App.ui.showSuccessToast("Flight was successfully registered");
      return App.contract.getFlightData(flightCode);
    })
    .then((data) => {
      App.flights[flightCode] = {...data};
      App.insurances[flightCode] = {
        amount: 0,
        refundAmount: 0,
        refundWithdrawn: false
      }
      App.renderFlights();
    })
    .catch(err => {
      App.ui.registerFlightModal.hide();
      App.displayError(err, `Failed to register flight: ${utils.cleanError(err)}`);
    });
  },
  buyInsurance: () => {
    const flightCode = App.ui.$buyInsuranceFlightCode.value;
    const amount = parseInt(App.ui.$buyInsurancePrice.value);

    App.contract.buyInsurance(flightCode, amount)
    .then(() => {
      App.ui.buyInsuranceModal.hide();
      App.ui.showSuccessToast("Insurance was successfully bought");
      App.insurances[flightCode].amount = utils.ethToWei(amount);
      App.renderFlights();
    })
    .catch(err => {
      App.ui.buyInsuranceModal.hide();
      App.displayError(err, "Failed to buy insurance");
    });
  },
  withdrawRefund: (flightCode) => {
    App.contract.withdrawRefund(flightCode)
    .then(() => {
      App.insurances[flightCode].refundWithdrawn = true;
      App.renderFlights();
    })
    .catch(err => {
      App.displayError(err, "Failed to withdraw refund");
    })
  },
  fetchFlightStatus: (flightCode) => {
    const timestamp = utils.now();

    App.contract.fetchFlightStatus(flightCode, timestamp)
    .then(() => {
      App.flights[flightCode].flightStatusLoading = true;
      App.renderFlights();
    })
    .catch(err => {
      App.displayError(err, `Failed to request flight status for flight ${flightCode}`);
    })
  },
  createFlightListItem: (flightCode, flightData, insuranceData) => {
    let listItem = DOM.a({
      href: "#",
      className: "list-group-item"
    });

    let topDiv = listItem.appendChild(DOM.div({
      className: "d-flex w-100 justify-content-between"
    }));
    topDiv
      .appendChild(DOM.h5({className: "mb-1"}))
      .appendChild(DOM.strong())
      .appendChild(DOM.text(flightCode));

    let insuranceStatus = "";
    if (insuranceData.refundWithdrawn) {
      insuranceStatus = "Refunded"
    } else if (insuranceData.refundAmount > 0) {
      insuranceStatus = "Refund credited";
    } else if (insuranceData.amount > 0) {
      insuranceStatus = "Insured";
    }
    if (insuranceStatus.length > 0) {
      let insuranceStatusArea = topDiv
        .appendChild(DOM.small())
        .appendChild(DOM.strong());
      insuranceStatusArea.appendChild(DOM.text(insuranceStatus.toUpperCase()));
      if (insuranceData.refundAmount > 0 && !insuranceData.refundWithdrawn) {
        insuranceStatusArea
          .appendChild(DOM.button({className: "btn btn-sm btn-warning ms-1", id: `withdraw-button_${flightCode}`}))
          .appendChild(DOM.text("Withdraw"));
      }
    }

    let middleP = listItem.appendChild(DOM.p({className: "mb-1"}));
    middleP.appendChild(DOM.strong()).appendChild(DOM.text(`Airline: `))
    middleP.appendChild(DOM.text(App.airlines[flightData.airline.toLowerCase()].name))

    let airlineBadge = middleP.appendChild(DOM.span({className: "badge bg-light ms-1"}))
    airlineBadge.setAttribute("data-bs-toggle", "tooltip");
    airlineBadge.setAttribute("data-bs-placement", "top");
    airlineBadge.setAttribute("data-bs-title", flightData.airline);
    airlineBadge.appendChild(DOM.code(utils.shortenAddress(flightData.airline)));

    const statusDetails = App.getStatusDetails(flightData.statusCode);
    let statusArea = listItem.appendChild(DOM.span());
    statusArea.appendChild(DOM.strong()).appendChild(DOM.text("Status:"));

    if (flightData.statusCode == App.statusCodes.STATUS_CODE_UNKNOWN) {
      statusArea
        .appendChild(DOM.span({ className: "badge bg-secondary ms-1" }))
        .appendChild(DOM.text(statusDetails.status));
    } else {
      let status = statusArea.appendChild(DOM.span({
        className: flightData.statusCodeVerified ? "badge bg-success ms-1" : "badge bg-warning ms-1"
      }));
      if (!flightData.statusCodeVerified) {
        status.style["color"] = "black";
      }
      status.setAttribute("data-bs-toggle", "tooltip");
      status.setAttribute("data-bs-placement", "top");
      status.setAttribute("data-bs-title", flightData.statusCodeVerified ? "Verified" : "Not verified");
      status.appendChild(DOM.text(statusDetails.status));
      status.appendChild(DOM.i({className: flightData.statusCodeVerified ? "bi bi-check-circle-fill ms-1" : "bi bi-exclamation-triangle ms-1"}));
    }
    if (statusDetails.reason.length > 0) {
      statusArea
        .appendChild(DOM.i())
        .appendChild(DOM.text(` due to ${statusDetails.reason}`));
    }
    statusArea
      .appendChild(DOM.small())
      .appendChild(DOM.strong())
      .appendChild(DOM.text(` (${moment(parseInt(flightData.updatedTimestamp) * 1000).startOf('minute').fromNow()})`));

    const insurance = App.insurances[flightCode];

    let insuranceButton = listItem.appendChild(DOM.button({
      className: "btn btn-sm btn-primary insurance-button ms-2",
      id: `insurance-button_${flightCode}`,
    }));
    insuranceButton.appendChild(DOM.text("Buy insurance"));
    insuranceButton["disabled"] = flightData.statusCodeVerified;

    let fetchStatusButton = listItem.appendChild(DOM.button({
      className: "btn btn-sm btn-secondary mb-2",
      id: `fetch-status-button_${flightCode}`
    }))
    fetchStatusButton.style["float"] = "right";
    fetchStatusButton["disabled"] = flightData.statusCodeVerified;

    if (flightData.flightStatusLoading) {
      fetchStatusButton.appendChild(DOM.span({className: "spinner-border spinner-border-sm me-1"}))
      fetchStatusButton
        .appendChild(DOM.span({role: "status"}))
        .appendChild(DOM.text("Fetching..."));
    } else {
      fetchStatusButton.appendChild(DOM.text("Fetch status"));
    }

    return listItem;
  },
  getStatusDetails: (statusCode) => {
    if (statusCode == App.statusCodes.STATUS_CODE_UNKNOWN) {
      return { status: "UNKNOWN", reason: "" };
    } else if (statusCode == App.statusCodes.STATUS_CODE_LATE_AIRLINE) {
      return { status: "DELAYED", reason: "airline fault" };
    } else if (statusCode == App.statusCodes.STATUS_CODE_LATE_TECHNICAL) {
      return { status: "DELAYED", reason: "technical reasons" };
    } else if (statusCode == App.statusCodes.STATUS_CODE_LATE_WEATHER) {
      return { status: "DELAYED", reason: "weather conditions" };
    } else if (statusCode == App.statusCodes.STATUS_CODE_ON_TIME) {
      return { status: "ON TIME", reason: "" };
    } else if (statusCode == App.statusCodes.STATUS_CODE_LATE_OTHER) {
      return { status: "DELAYED", reason: "unknown reason" };
    }
  },
  renderDom: () => {
    App.renderAirlineActions();
    App.renderFlights();
    App.setupDomEvents();
  },
  renderAirlineActions: () => {
    const airlineAccounts = Object.keys(App.airlines);
    const currentAccountIsAirline = airlineAccounts.includes(App.currentAccount);

    if (!currentAccountIsAirline) {
      App.ui.hideActionsMenu();
      return;
    }

    App.ui.showActionsMenu();

    const hasFunded = App.airlines[App.currentAccount].hasFunded;

    if (hasFunded) {
      App.ui.enableContributingAirlineActions();
    } else {
      App.ui.disableContributingAirlineActions();
    }

  },
  renderFlights: () => {
    const filterValue = App.ui.$filterFlights.value.toLowerCase();
    let flights = filterValue.length > 0
    ? Object.fromEntries(Object.entries(App.flights).filter(([key]) => filterValue === "" || key.toLowerCase().includes(filterValue)))
    : App.flights;

    const flightCodes = Object.keys(flights).reverse();

    const flightListItems = flightCodes.map(fc => App.createFlightListItem(fc, flights[fc], App.insurances[fc]));

    App.ui.renderFlightListItems(flightListItems);

    App.setupButtonsEvents(flightCodes);
  },
  onFlightStatusReceived: (data) => {
    App.flights[data.flightCode].statusCode = data.statusCode;
    App.flights[data.flightCode].statusCodeVerified = data.verified;
    App.flights[data.flightCode].updatedTimestamp = data.timestamp;
    App.flights[data.flightCode].flightStatusLoading = false;
    App.renderFlights();
  },
  onFlightInsuranceRefundCredited: (data) => {
    if (data.passenger.toLowerCase() == App.currentAccount.toLowerCase()) {
      App.ui.showInfoToast(`A refund has been credited to your account due to delay of flight: ${data.flightCode}`);
      App.insurances[data.flightCode].refundAmount = data.refundAmount;
      App.renderFlights();
    }
  },
  getContractEventHandlers: () => {
    return {
      FlightStatusReceived: App.onFlightStatusReceived,
      FlightInsuranceRefundCredited: App.onFlightInsuranceRefundCredited
    };
  },
  onInsuranceButtonClick: (flightCode) => {
    return () => {
      App.ui.$buyInsuranceFlightCode.value = flightCode;
      App.ui.buyInsuranceModal.show();
    }
  },
  onWithdrawButtonClick: (flightCode) => () => App.withdrawRefund(flightCode),
  onFetchStatusButtonClick: (flightCode) => () => App.fetchFlightStatus(flightCode),
  setupButtonsEvents: (flightCodes) => {
    flightCodes.forEach(fc => {
      App.ui.on("click", DOM.elid(`insurance-button_${fc}`), App.onInsuranceButtonClick(fc));
      App.ui.on("click", DOM.elid(`withdraw-button_${fc}`), App.onWithdrawButtonClick(fc));
      App.ui.on("click", DOM.elid(`fetch-status-button_${fc}`), App.onFetchStatusButtonClick(fc));
    })
  },
  setupDomEvents: () => {
    App.ui.on("click", App.ui.$buyInsuranceConfirmButton, App.buyInsurance);
    App.ui.on("click", App.ui.$registerAirlineButton, () => { App.ui.registerAirlineModal.show(); });
    App.ui.on("click", App.ui.$registerAirlineConfirmButton, App.registerAirline);
    App.ui.on("click", App.ui.$registerFlightButton, () => { App.ui.registerFlightModal.show(); });
    App.ui.on("click", App.ui.$registerFlightConfirmButton, App.registerFlight);
    App.ui.on("click", App.ui.$fundAirlineButton, () => { App.ui.fundAirlineModal.show(); });
    App.ui.on("click", App.ui.$fundAirlineConfirmButton, App.fundAirline);
    App.ui.on("keyup", App.ui.$filterFlights, App.renderFlights);

    App.setupButtonsEvents(Object.keys(App.flights));
  }
};

window.App = App;