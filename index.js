//Proudly made WITHOUT GenAI assistance
//by Zayre Fox - BlueSky: @orca.fish

var config = {};
var NUM_TRAINS_TO_DISPLAY = undefined;

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
      url: `https://api.wmata.com/Incidents.svc/json/Incidents`,
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

  if (config.overrideBoardFontSize) {
    lineDiv.style.fontSize = `${config.overrideBoardFontSize}em`;
    destDiv.style.fontSize = `${config.overrideBoardFontSize}em`;
    carDiv.style.fontSize = `${config.overrideBoardFontSize}em`;
    timeDiv.style.fontSize = `${config.overrideBoardFontSize}em`;
  }

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

  if (!config.legacyLineIndicators && line !== "LN") {
    lineDiv.innerText = line[0];
  } else {
    lineDiv.innerText = line;
  }

  destDiv.innerText = cleanDestinationtext(destination);
  carDiv.innerText = cars;

  if (carDiv.innerText === "8") {
    carDiv.style.color = "limegreen";
  }

  timeDiv.innerText = time;

  arrivalInstance.appendChild(lineDiv);

  if (config.showCar) {
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

//Check if the specified incident matches any lines of interest in the config
function isIncidentRelevant(incident) {
  var isRelevant = false;

  config.serviceAdvisoryLines.forEach((line) => {
    isRelevant =
      isRelevant ||
      incident.LinesAffected.toLowerCase().includes(`${line.toLowerCase()};`);
  });

  return isRelevant;
}
//This funciton will update the system incidents display as they
//appear

async function updateAlertsThread() {
  while (true) {
    const incidents = await getSystemIncidents();
    var relevantIncidents = [];
    incidents.Incidents.forEach((incident) => {
      if (isIncidentRelevant(incident)) {
        relevantIncidents.push(incident);
      }
    });

    if (config.fullScreenIncidents) {
      //Set custom font size override if necessary
      if (config.overrideFullScreenAlertFontSize) {
        $("#full-screen-service-advisory").css(
          "font-size",
          `${config.overrideFullScreenAlertFontSize}em`
        );
      }

      //Display the alert using the full screen method
      for (let index = 0; index < relevantIncidents.length; index++) {
        $("#full-screen-service-advisory").html("SERVICE<br>ADVISORY");
        $("#fs-alert-container").css("visibility", "visible");
        await sleep(5000);
        $("#fs-alert-container").css("visibility", "hidden");

        //Only display the portion of the message that actually fits on screen. Dynamically done so it can support any size display
        const messageTokens = relevantIncidents[index].Description.replaceAll(
          "â€™", //WMATA API is sending bad Unicode for apostrophes
          "'"
        ).split(" ");
        let messageStartingIndex = 0;
        for (let x = 0; x <= messageTokens.length; x++) {
          $("#full-screen-service-advisory").text(
            messageTokens.slice(messageStartingIndex, x).join(" ")
          );
          //Oops we went too far
          if (
            $("#full-screen-service-advisory").outerHeight() >
            $("#fs-alert-container").outerHeight()
          ) {
            $("#full-screen-service-advisory").text(
              messageTokens.slice(messageStartingIndex, x - 1).join(" ")
            );
            $("#fs-alert-container").css("visibility", "visible");
            messageStartingIndex = x;
            await sleep(config.fullScreenAlertPagingDelay);
            $("#fs-alert-container").css("visibility", "hidden");
          }
        }
        $("#fs-alert-container").css("visibility", "visible");
        await sleep(config.fullScreenAlertPagingDelay);
        $("#fs-alert-container").css("visibility", "hidden");
        await sleep(config.fullScreenAlertCycleDelay);
      }
      $("#fs-alert-container").css("visibility", "hidden");
      await sleep(config.idleAlertPulse);
    } else {
      // Display the alert on the bottom of the screen
      if (relevantIncidents.length > 0) {
        for (let index = 0; index < relevantIncidents.length; index++) {
          document.getElementsByClassName("service-alerts")[0].style.display =
            "block";
          NUM_TRAINS_TO_DISPLAY = config.maxTrainsOnTableAlert;
          renderTimeTable();
          $("#incident-display-box").text(relevantIncidents[index].Description);
          await sleep(config.alertDisplayLength);
          document.getElementsByClassName("service-alerts")[0].style.display =
            "none";
        }

        NUM_TRAINS_TO_DISPLAY = config.maxTrainsOnTableDefault;
        renderTimeTable();
      } else {
        await sleep(config.idleAlertPulse);
      }
    }
  }
}

async function startWMATA() {
  //(Optional) Hide the header at the top of the page
  if (!config.showHeader) {
    $("#page-header").css("display", "none");
  }

  if (config.overrideHeaderFontSize) {
    $("#station-name").css("font-size", `${config.overrideHeaderFontSize}em`);
    $("#logo").css("height", `${config.overrideHeaderFontSize}em`);
  }

  //Pulls the station name from the WMATA API according to the station code in the config
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

  while (true) {
    renderTimeTable();
    await sleep(config.apiQueryTimer);
  }
}

async function renderTimeTable() {
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
    .fail(function (error, status, message) {
      document.body.innerText = `Something went wrong! ${message}`;
    });
}

async function initiateProgram() {
  await fetch("./cfg.json")
    .then((response) => {
      return response.json();
    })
    .then((data) => (config = data));

  const params = new URLSearchParams(document.location.search);

  //Overwrite any parameters that are provided as URL arguments
  for (let param of params) {
    config[param[0]] = param[1];
  }

  //Set the maximum number of trains to display based on the config
  NUM_TRAINS_TO_DISPLAY = config.maxTrainsOnTableDefault;

  if (config.metroLogoStyle === "new") {
    $("#logo").attr("src", "./media/metro logo new.png");
  }

  startWMATA();
  if (config.displayServiceAdvisories) {
    updateAlertsThread();
  }
}

initiateProgram();
