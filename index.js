var config = {};
var NUM_TRAINS_TO_DISPLAY = 5; //Defaults to showing 5 trains, but needs to be mutable for when service alerts are active.

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function filterIncidents(incidents) {
  var filtered = [];

  incidents = incidents["Incidents"];
  for (index in incidents) {
    filtered.push(incidents[index]["Description"]);
  }

  return filtered;
}

function displayIncidents(incident) {
  const incidentContainer = document.getElementById("incident-display-box");
  incidentContainer.innerText = incident;
}

function getSystemIncidents() {
  return new Promise(function (resolve, reject) {
    $.ajax({
      url: `http://api.wmata.com/Incidents.svc/json/Incidents`,
      headers: { api_key: config.apiKey },
      type: "GET",
      success: function (data) {
        resolve(data);
      },
      error: function (err) {
        reject(err);
      },
    });
  });
}

function cleanDestinationtext(destination) {
  //Special cases for destinations that are abbreviated.
  switch (destination) {
    case "DwtnLargo":
      return "Downtown Largo";

    case "MtVern Sq":
      return "Mt. Vernon Square";

    case "Vienna/Fairfax-GMU":
      return "Vienna";

    default:
      return destination;
  }
}

function lineBuilder(line, destination, cars, time) {
  const arrivalInstance = document.createElement("div");
  arrivalInstance.classList.add("wmata-arrival");

  //Change the text font and color for Dot Matrix mode
  switch (config.layout) {
    case "dotMatrix":
      arrivalInstance.classList.add("dotMatrixText");
      break;

    case "modern":
      arrivalInstance.classList.add("modernText");

    default:
      arrivalInstance.classList.add("defaultText");
  }

  const lineDiv = document.createElement("div");
  const destDiv = document.createElement("div");
  const carDiv = document.createElement("div");
  const timeDiv = document.createElement("div");

  lineDiv.classList.add("wmata-line-div");
  destDiv.classList.add("wmata-dest-div");
  carDiv.classList.add("wmata-car-div");
  timeDiv.classList.add("wmata-time-div");

  //Change to colored line indicators on modern themes
  if (config.layout === "modern") {
    lineDiv.classList.add("colored-line-icon");

    switch (line) {
      case "LN":
        //Special case for the LN instance in the first row. We want to apply the class so it lines up with the icons below, but don't want to assign it a color.
        break;
      case "RD":
        lineDiv.classList.add("red");
        break;
      case "OR":
        lineDiv.classList.add("orange");
        break;
      case "BL":
        lineDiv.classList.add("blue");
        break;
      case "GR":
        lineDiv.classList.add("green");
        break;
      case "YL":
        lineDiv.classList.add("yellow");
        break;
      case "SV":
        lineDiv.classList.add("silver");
        break;
      default:
        lineDiv.classList.add("white");
        break;
    }
  }

  if (config.legacyLineIndicators !== "true" && line !== "LN") {
    lineDiv.innerText = line[0];
  } else {
    lineDiv.innerText = line;
  }

  destDiv.innerText = cleanDestinationtext(destination);
  carDiv.innerText = cars;
  timeDiv.innerText = time;

  arrivalInstance.appendChild(lineDiv);

  if (config.showCar === "true") {
    arrivalInstance.appendChild(carDiv);
  }

  arrivalInstance.appendChild(destDiv);
  arrivalInstance.appendChild(timeDiv);

  //Special case for setting the top line red when in dotMatrix mode
  if (line === "LN" && config.layout === "dotMatrix") {
    arrivalInstance.classList.add("dot-matrix-header");
  } else if (line === "LN" && config.layout === "modern") {
    arrivalInstance.classList.add("modern-header");
  }

  return arrivalInstance;
}

//This funciton will update the system incidents display as they
//appear

async function updateAlertsThread() {
  while (true) {
    const incidents = await getSystemIncidents();
    var relevantIncidents = [];
    incidents.Incidents.forEach((incident) => {
      if (
        //TODO: Make this NOT hard coded!
        incident.LinesAffected.includes("OR;") ||
        incident.LinesAffected.toLowerCase().includes("loring")
      ) {
        relevantIncidents.push(incident);
      }
    });

    console.log(relevantIncidents);

    if (relevantIncidents.length > 0) {
      document.getElementsByClassName("service-alerts")[0].style.display =
        "block";
      for (let index = 0; index < relevantIncidents.length; index++) {
        NUM_TRAINS_TO_DISPLAY = 4;
        document.getElementById("incident-display-box").innerText =
          relevantIncidents[index].Description;
        await sleep(config.alertDisplayLength);
        console.log("Completed Sleep Timer");
      }

      NUM_TRAINS_TO_DISPLAY = 5;
    } else {
      await sleep(config.idleAlertPulse);
    }
  }
}

async function startWMATA() {
  //(Optional) Hide the header at the top of the page
  if (config.showHeader === "false") {
    document.getElementById("page-header").style.display = "none";
  }

  $.ajax({
    url: `https://api.wmata.com/Rail.svc/json/jStations`,
    headers: { api_key: config.apiKey },
    type: "GET",
  }).done(function (data) {
    var foundStationName = false;
    for (station in data.Stations) {
      if (data.Stations[station].Code === config.stationCode) {
        document.getElementById("station-name").innerText =
          data.Stations[station].Name;
        document.title = data.Stations[station].Name;
        foundStationName = true;
      }
    }
    if (!foundStationName) {
      document.getElementById("station-name").innerText =
        "INVALID STATION CODE";
      return;
    }
  });

  //Get the currently active incidents
  var incidents;
  getSystemIncidents().then((response) => {
    incidents = filterIncidents(response);
  });

  while (true) {
    $.ajax({
      url: `https://api.wmata.com/StationPrediction.svc/json/GetPrediction/${config.stationCode}`,
      headers: { api_key: config.apiKey },
      type: "GET",
    })
      .done(function (data) {
        let container = document.createElement("div");

        //Create the Arrival for Each Entry
        container.appendChild(lineBuilder("LN", "DEST", "CAR", "MIN"));

        for (
          let x = 0;
          x < Math.min(data.Trains.length, NUM_TRAINS_TO_DISPLAY);
          x++
        ) {
          let train = data.Trains[x];
          container.appendChild(
            lineBuilder(train.Line, train.Destination, train.Car, train.Min)
          );
        }

        document.getElementById("wmata-board").innerHTML = container.innerHTML;
      })
      .fail(function () {
        console.error(
          "Something went wrong. Double check your API key and make sure you're using a valid station code"
        );
      });

    await sleep(config.apiQueryTimer);
  }
}

async function initiateProgram() {
  await fetch("./cfg.json")
    .then((response) => {
      return response.json();
    })
    .then((data) => (config = data));

  await fetch("./apiKey.json")
    .then((response) => {
      return response.json();
    })
    .then((data) => (config.apiKey = data.apiKey));

  startWMATA();
  updateAlertsThread();
}

initiateProgram();
