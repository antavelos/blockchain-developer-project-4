import DOM from "./dom";

export default class UI {
  constructor(mainElementId) {
    this.$el = DOM.elid(mainElementId);

    this.$operationalContractText = DOM.elid("operationalContractText");

    this.$airlineActionsDropdown = DOM.elid("airlineActionsDropdown");

    this.$filterFlights = DOM.elid("filterFlights");

    this.buyInsuranceModal = new bootstrap.Modal("#buyInsuranceModal");
    this.$buyInsuranceFlightCode = DOM.elid("buyInsuranceFlightCode");
    this.$buyInsurancePrice = DOM.elid("buyInsurancePrice");
    this.$buyInsuranceConfirmButton = DOM.elid("buyInsuranceConfirmButton");

    this.registerFlightModal = new bootstrap.Modal("#registerFlightModal");
    this.$registerFlightCode = DOM.elid("registerFlightCode");
    this.$registerFlightButton = DOM.elid("registerFlightButton");
    this.$registerFlightConfirmButton = DOM.elid("registerFlightConfirmButton");

    this.registerAirlineModal = new bootstrap.Modal("#registerAirlineModal");
    this.$registerAirlineName = DOM.elid("registerAirlineName");
    this.$registerAirlineAddress = DOM.elid("registerAirlineAddress");
    this.$registerAirlineButton = DOM.elid("registerAirlineButton");
    this.$registerAirlineConfirmButton = DOM.elid("registerAirlineConfirmButton");

    this.fundAirlineModal = new bootstrap.Modal("#fundAirlineModal");
    this.$fundAirlineAmount = DOM.elid("fundAirlineAmount");
    this.$fundAirlineConfirmButton = DOM.elid("fundAirlineConfirmButton");
    this.$fundAirlineButton = DOM.elid("fundAirlineButton");

    this.errorToast = new bootstrap.Toast("#errorToast");
    this.$errorToastBody = DOM.elid("errorToastBody");
    this.successToast = new bootstrap.Toast("#successToast");
    this.$successToastBody = DOM.elid("successToastBody");
    this.infoToast = new bootstrap.Toast("#infoToast");
    this.$infoToastBody = DOM.elid("infoToastBody");
  }

  _showElement(el) {
    el.style["display"] = "block";
  }

  _hideElement(el) {
    el.style["display"] = "none";
  }

  showErrorToast(message) {
      this.$errorToastBody.setHTML(message);
      this.errorToast.show();
  }

  showSuccessToast(message) {
      this.$successToastBody.setHTML(message);
      this.successToast.show();
  }

  showInfoToast(message) {
      this.$infoToastBody.setHTML(message);
      this.infoToast.show();
  }

  showActionsMenu() {
    this._showElement(this.$airlineActionsDropdown);
  }

  hideActionsMenu() {
    this._hideElement(this.$airlineActionsDropdown);
  }

  setNotOperational() {
    this._hideElement(this.$el);
    this._hideElement(this.$filterFlights);
    this._hideElement(this.$airlineActionsDropdown);
    this._showElement(this.$operationalContractText);
  }

  setOperational() {
    this._hideElement(this.$operationalContractText);
    this._showElement(this.$filterFlights);
    this._showElement(this.$el);
  }

  enableContributingAirlineActions() {
    this.$fundAirlineButton.classList.add("disabled");
    this.$registerAirlineButton.classList.remove("disabled");
    this.$registerFlightButton.classList.remove("disabled");
  }

  disableContributingAirlineActions() {
    this.$fundAirlineButton.classList.remove("disabled");
    this.$registerAirlineButton.classList.add("disabled");
    this.$registerFlightButton.classList.add("disabled");
  }

  renderSpinner() {
    this.$el.innerHTML = "";

    this.$el
    .appendChild(DOM.div({className: "d-flex justify-content-center"}))
    .appendChild(DOM.div({className: "d-flex spinner-border", role: "status"}))
      .appendChild(DOM.span({className: "visually-hidden"}))
      .appendChild(DOM.text("Loading..."));
    }

    renderFlightListItems(flightListItems) {
    this.$el.innerHTML = "";

    const selg = this;
    flightListItems.forEach(item => {
      this.$el.appendChild(item);
    });

    this._initTooltips();
  }

  on(eventType, element, callback) {
    try {
      element.addEventListener(eventType, callback);
    } catch(err) {
      // ignore errors of missing elements
      if (!(err instanceof TypeError)) {
        console.log(err);
      }
    }
  }

  _initTooltips() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))
  }
};