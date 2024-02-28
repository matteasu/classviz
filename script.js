/*
TODO
- role stereotypes DONE
- filtering stereotypes DONE
- remove bug tab DONE
- try font sizing DONE
- animate dynamic aspects
- summaries to sidebar DONE
- architecture recovery/clustering
- collapse the classes
- more padding inside packages DONE
- tweak klay parameters
*/

document.addEventListener('DOMContentLoaded', async function () {
  const filePrefix = (new URLSearchParams(window.location.search)).get('p');

  if (filePrefix) {
    try {
      const response = await fetch(`data/${filePrefix ? filePrefix : ''}.json`);
      const json = await response.json();
      const eles = prepareEles(json.elements);

      document.getElementById("filename").textContent = `Software Visualization: ${filePrefix}.json`;

      const styleResponse = await fetch('style.cycss');
      const style = await styleResponse.text();

      await initCy([eles, style]);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }
});

const prepareEles = function (eles) {
  eles.nodes.forEach((node) => {
    node.data.name = node.data.properties.shortname || node.data.properties.simpleName;
    node.data.label = `${node.data.name}`;
  });

  eles.edges.forEach((edge) => {
    edge.data.interaction = edge.data.label || edge.data.labels.join();
  });

  return eles;
};

const setParents = function (relationship, inverted) {
  cy.edges("#parentRel").removeClass("parentRel");

  if (inverted) {
    cy.edges(`[interaction = "${relationship}"]`).forEach((edge) => {
      edge.source().move({ parent: edge.target().id() });
    });
  } else {
    cy.edges(`[interaction = "${relationship}"]`).forEach((edge) => {
      edge.target().move({ parent: edge.source().id() });
    });
  }

  cy.edges(`[interaction = "${relationship}"]`).addClass("parentRel");
}

let parentRel = "contains";

const role_stereotypes = {
  "Controller": { symbol: "CT", color_dark: "#984ea3", color_light: "#decbe4" },
  "Coordinator": { symbol: "CO", color_dark: "#4daf4a", color_light: "#ccebc5" },
  "Information Holder": { symbol: "IH", color_dark: "#e4105c", color_light: "#fbb4ae" },
  "Interfacer": { symbol: "IT", color_dark: "#ff7f00", color_light: "#fed9a6" },
  "Service Provider": { symbol: "SP", color_dark: "#377eb8", color_light: "#b3cde3" },
  "Structurer": { symbol: "ST", color_dark: "#f781bf", color_light: "#fddaec" },
  "*": { symbol: "UR", label: "Unreliable" },
  "-": { symbol: "UD", label: "Undetermined" }
};

const ft_colors = [
  "#8dd3c7",
  "#ffffb3",
  "#bebada",
  "#fb8072",
  "#80b1d3",
  "#fdb462",
  "#b3de69",
  "#fccde5",
  "#d9d9d9",
  "#bc80bd",
  "#ccebc5",
  "#ffed6f",
];

function generateExpColOptions(layoutName = "klay") {
  let cyExpandCollapseOptions = {
    // set default layout by klay
    layoutBy: null,
    animate: true,
    fisheye: false,
    undoable: false,
    cueEnabled: true,
    expandCollapseCuePosition: "top-left",
    groupEdgesOfSameTypeOnCollapse: true,
    allowNestedEdgeCollapse: true,
  };

  return cyExpandCollapseOptions;
}

// Memory to save expanded and collapsed nodes in stack
let expandedNodesIdx = [];
let collapsedNodes = [];
let zoom = { value: 1 };

const initCy = async function (payload) {
  const cy = window.cy = cytoscape({
    container: document.getElementById('cy'),
    elements: {
      nodes: payload[0].nodes,
      edges: payload[0].edges,
    },

    // inititate cytoscape expand collapse
    ready: function () {
      let api = this.expandCollapse(generateExpColOptions());

      document
        .getElementById("collapseNodes")
        .addEventListener("click", () => api.collapseAll());
      document
        .getElementById("expandNodes")
        .addEventListener("click", () => api.expandAll());
    },
    style: payload[1],
    wheelSensitivity: 0.25,
  });

  setParents(parentRel, false);

  // Isolate nodes with kind equals to package
  cy.nodes('[properties.kind = "package"]').forEach((n, idx) => {
    const d = n.ancestors().length;
    const grey = Math.min(160 + (d * 20), 255);
    n.style('background-color', `rgb(${grey},${grey},${grey})`);
  });

  //fillRSFilter(cy);
  fillRelationshipToggles(cy);
  //fillFeatureDropdown(cy);
  fillBugsDropdown(cy);

  bindRouters();

  const cbShowPrimitives = document.getElementById("showPrimitives");
  const cbShowPackages = document.getElementById("showPackages");

  cbShowPrimitives.checked = false;
  cbShowPackages.checked = true;

  showPrimitives(cbShowPrimitives);
  showPackages(cbShowPackages);

  zoom.value = cy.zoom();
  cy.nodes().filter('node').forEach(n => (bindPopper(n)))
  return cy;
}

// Get a reference to the div element
var infoTitle = document.getElementById("infotitle");
var infoBody = document.getElementById("infobody");

// Add a click event listener to the div
infoTitle.addEventListener("click", () => {
  if (infoBody.style.display === "none") {
    infoBody.style.display = "block";
    infoTitle.style.borderBottomLeftRadius = 0;
    infoTitle.style.borderBottomRightRadius = 0;
    infoTitle.style.borderBottom = "1px solid #9b999b";
  } else {
    infoBody.style.display = "none";
    infoTitle.style.borderBottomLeftRadius = "inherit";
    infoTitle.style.borderBottomRightRadius = "inherit";
    infoTitle.style.borderBottom = 0;
  }
});

function bindRouters() {
  // Initiate cyExpandCollapseApi
  let api = cy.expandCollapse("get");

  // right click dims the element
  cy.on('cxttap', 'node,edge',
    evt => {
      evt.target.addClass("dimmed")
      const interactions = [...document.querySelectorAll('input[name="showrels"]')]
        .filter(cb => cb.checked)
        .map(cb => cb.value);

      const edges = evt.target
        .connectedEdges()
        .filter((e) => interactions.includes(e.data("interaction")));
      edges.addClass("dimmed");
    });

  // left click highlights the node and its connected edges and nodes
  cy.on("tap", "node", (evt) => {
    evt.target.removeClass("dimmed");

    // currently visible relationship types
    const interactions = [...document.querySelectorAll('input[name="showrels"]')]
      .filter(cb => cb.checked)
      .map(cb => cb.value);

    const edges = evt.target
      .connectedEdges()
      .filter((e) => interactions.includes(e.data("interaction")));
    edges.removeClass("dimmed");
    edges.connectedNodes().removeClass("dimmed");
  });

  // left click highlights the edge and its connected nodes
  cy.on("tap", "edge", (evt) => {
    evt.target.removeClass("dimmed");
    evt.target.connectedNodes().removeClass("dimmed");
  });

  cy.on("mouseover", "node", (evt) => {
    var infoHeader = document.createElement("h3");
    var infoSubeader = document.createElement("p");
    var infoText = document.createElement("p");

    infoHeader.textContent = evt.target.data()["properties"]["simpleName"];
    infoSubeader.innerHTML = `<b><i>${evt.target.data()["properties"]["kind"]
    }</i></b>`;
    infoText.innerHTML = evt.target.data()["properties"]["vulnerabilities"] ? nodeVul(evt) : "";

   /* if (evt.target.data()['labels'].includes('Structure')) {
      if (evt.target.data()["properties"]["rs"]) {
        infoBody.style.backgroundColor =
          role_stereotypes[evt.target.data()["properties"]["rs"]].color_light;
        infoSubeader.innerHTML = `<b><i>${evt.target.data()["properties"]["kind"]
          }</i> – ${evt.target.data()["properties"]["rs"]}</b>`;
      } else {
        infoBody.style.backgroundColor = "inherit";
        infoSubeader.innerHTML = `<b><i>${evt.target.data()["properties"]["kind"]
          }</i></b>`;
      }
    } else if (evt.target.data()["labels"].includes("Container")) {
      infoBody.style.backgroundColor = "inherit";
      infoSubeader.innerHTML = `<b><i>${evt.target.data()["properties"]["kind"]
        }</i></b>`;
    }*/

    infoBody.innerHTML = "";
    infoBody.appendChild(infoHeader);
    infoBody.appendChild(infoSubeader);
    infoBody.appendChild(infoText);
    if(evt.target.popper){
      if (!evt.target.hasClass('dimmed')) {
        let tooltipId = `popper-target-${evt.target.id()}`;
        if (document.getElementById(tooltipId)) {
          document.getElementById(tooltipId).classList.add("active");
        }
      }
    }
  });
  cy.on("mouseout","node",(evt)=>{
    if(evt.target.popper){
      if (!evt.target.hasClass('dimmed')) {
        let tooltipId = `popper-target-${evt.target.id()}`;
        if (document.getElementById(tooltipId)) {
          document.getElementById(tooltipId).classList.remove("active");
        }
      }
    }
  })
}

const nodeVul = function(evt) {
  const data = evt.target.data()["properties"]["vulnerabilities"]
  const counts = {}
  let output = "<ul>"
  data.forEach(vul=>{
    counts[vul['analysis_name']] = counts[vul['analysis_name']] ? counts[vul['analysis_name']] +1 : 1
  })
  Object.keys(counts).forEach(k=>{
    output+="<li>"+k+": "+counts[k]+"</li>"
  })
  output+="</ul>"
  return output
}

/* Sidebar Utility Functions */
const relayout = function (layout) {
  cy.layout({
    name: layout,
    animate: true,
    nodeDimensionsIncludeLabels: true,
    klay: {
      direction: "DOWN",
      edgeRouting: "ORTHOGONAL",
      routeSelfLoopInside: true,
      thoroughness: 4,
      spacing: 32,
    },
  }).run();
  // Re set the expandCollapse options
  cy.expandCollapse(generateExpColOptions(layout));
};

const saveAsSvg = function (filename) {
  const svgContent = cy.svg({ scale: 1, full: true, bg: 'beige' });
  const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
  saveAs(blob, filename);
};

const getSvgUrl = function () {
  const svgContent = cy.svg({ scale: 1, full: true, bg: 'beige' });
  const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
  return URL.createObjectURL(blob);
};

const showPrimitives = function (ele) {
  cy.nodes()
    .filter((n) => n.data("labels").includes("Primitive") || n.data("id") === "java.lang.String")
    .style({ display: ele.checked ? "element" : "none" });
};

const showPackages = function (ele) {
  cy.nodes()
    .filter((n) => n.data("labels").includes("Container") && !n.data("labels").includes("Structure"))
    .toggleClass("pkghidden", !ele.checked);
};

const setVisible = function (ele) {
  cy.edges(`[interaction = "${ele.value}"]`).toggleClass(
    "hidden",
    !ele.checked
  );
};

const setLineBends = function (ele) {
  if (ele.checked) {
    cy.edges(`[interaction = "${ele.name}"]`).style("curve-style", ele.value);
  }
};

const fileUpload = function () {
  const fileSelector = document.getElementById("file-selector");
  fileSelector.click();
  fileSelector.addEventListener("change", (event) => {
    const file = event.target.files[0];
    filePrefix = file.name;
    document.getElementById(
      "filename"
    ).textContent = `Software Visualization: ${filePrefix}`;
    const reader = new FileReader();
    reader.readAsText(file, "UTF-8");
    reader.onload = function (e) {
      json = JSON.parse(e.target.result);
      eles = prepareEles(json.elements);
      const style = fetch("style.cycss").then((res) => res.text());

      Promise.all([eles, style]).then(initCy);
    };
  });
};

flip = true;
const toggleVisibility = function () {
  cy.style()
    .selector(".dimmed")
    .style({
      display: flip ? "none" : "element",
    })
    .update();
  flip = !flip;
};

/* ======================================== */

const fillRSFilter = function (_cy) {
  const menuNodes = document.getElementById("menu-nodes");
  const rsFilters = menuNodes.getElementsByClassName('rs-filter-container');
  [...rsFilters].forEach((rsFilter) => menuNodes.removeChild(rsFilter))

  const containerDiv = document.createElement('div');
  containerDiv.setAttribute('class', 'rs-filter-container');
  const rsHeader = document.createElement("p");
  rsHeader.innerHTML = "<b>Role Stereotypes</b>";
  containerDiv.appendChild(rsHeader);

  Object.keys(role_stereotypes).forEach(key => {
    const div = document.createElement("div");
    const label = document.createElement("label");
    label.setAttribute("for", `rs-${role_stereotypes[key].symbol}`);
    label.setAttribute("class", "rslabel");
    label.style.backgroundColor = role_stereotypes[key].color_light;

    const checkbox = document.createElement("input");
    checkbox.setAttribute("type", "checkbox");
    checkbox.setAttribute("id", `rs-${role_stereotypes[key].symbol}`);
    checkbox.setAttribute("name", "showrs");
    checkbox.setAttribute("onchange", "showRS(this)");
    checkbox.setAttribute("value", key);
    checkbox.checked = true;

    const labelText = document.createTextNode(role_stereotypes[key].label || key);
    label.appendChild(checkbox);
    label.appendChild(labelText);

    div.appendChild(label);
    containerDiv.appendChild(div);
  });

  menuNodes.appendChild(containerDiv);
}

const fillRelationshipToggles = function (_cy) {
  const table = document.getElementById("reltab"); // Get the table element
  table.innerHTML = "";

  // Create the thead element
  const thead = document.createElement("thead");

  // Create the tr element for the table header row
  const headerRow = document.createElement("tr");

  // Create the th elements for the table header cells
  const th1 = document.createElement("th");
  th1.textContent = "Connection";
  const th2 = document.createElement("th");
  th2.textContent = "Ortho";
  const th3 = document.createElement("th");
  th3.textContent = "Bezier";

  // Append the th elements to the header row
  headerRow.appendChild(th1);
  headerRow.appendChild(th2);
  headerRow.appendChild(th3);

  // Append the header row to the thead element
  thead.appendChild(headerRow);

  // Append the thead element to the table element
  table.appendChild(thead);

  _cy
    .edges()
    .map((e) => e.data("interaction"))
    .filter((v, i, s) => s.indexOf(v) === i)
    .forEach((l) => {
      // Create a new row (tr)
      const row = document.createElement("tr");

      // Create the first cell (td) with a label and checkbox
      const cell1 = document.createElement("td");
      const label = document.createElement("label");
      label.setAttribute("for", l);
      const checkbox = document.createElement("input");
      checkbox.setAttribute("type", "checkbox");
      checkbox.setAttribute("id", l);
      checkbox.setAttribute("name", "showrels");
      checkbox.setAttribute("onchange", "setVisible(this)");
      checkbox.setAttribute("value", l);
      checkbox.checked = ["calls"].includes(l);
      const labelText = document.createTextNode(l);
      label.appendChild(checkbox);
      label.appendChild(labelText);
      cell1.appendChild(label);
      row.appendChild(cell1);

      // Create the second cell (td) with a radio button for taxi option
      const cell2 = document.createElement("td");
      const taxiRadio = document.createElement("input");
      taxiRadio.setAttribute("type", "radio");
      taxiRadio.setAttribute("onchange", "setLineBends(this)");
      taxiRadio.setAttribute("id", `${l}-ort`);
      taxiRadio.setAttribute("name", l);
      taxiRadio.setAttribute("value", "taxi");
      cell2.appendChild(taxiRadio);
      row.appendChild(cell2);

      // Create the third cell (td) with a radio button for bezier option
      const cell3 = document.createElement("td");
      const bezierRadio = document.createElement("input");
      bezierRadio.setAttribute("type", "radio");
      bezierRadio.setAttribute("onchange", "setLineBends(this)");
      bezierRadio.setAttribute("id", `${l}-bez`);
      bezierRadio.setAttribute("name", l);
      bezierRadio.setAttribute("value", "bezier");
      bezierRadio.checked = true;
      cell3.appendChild(bezierRadio);
      row.appendChild(cell3);

      // Append the row to the table
      table.appendChild(row);
    });

  document.querySelectorAll('input[name="showrels"]').forEach((checkbox) => {
    setVisible(checkbox);
  });
};

const fillFeatureDropdown = function (_cy) {
  let tracesSet = new Set();
  _cy.nodes().forEach((e) => {
    if (e.data("properties.traces")) {
      e.data("properties.traces").forEach((trace) => {
        tracesSet.add(trace);
      });
    }
  });

  let tracesList = [...tracesSet];

  // Get the dropdown element.
  const dropdown = document.getElementById("selectfeature");
  dropdown.innerHTML = "";

  tracesList.forEach(trace => {
    const div = document.createElement("div");
    const label = document.createElement("label");
    label.setAttribute("for", `feature-${trace}`);
    label.setAttribute("class", "featurelabel");

    const checkbox = document.createElement("input");
    checkbox.setAttribute("type", "checkbox");
    checkbox.setAttribute("id", `feature-${trace}`);
    checkbox.setAttribute("name", "showfeatures");
    checkbox.setAttribute("onchange", "showTrace(this)");
    checkbox.setAttribute("value", trace);

    const labelText = document.createTextNode(trace);
    label.appendChild(checkbox);
    label.appendChild(labelText);

    div.appendChild(label);
    dropdown.appendChild(div);
  });
};

const fillBugsDropdown = function (_cy) {
  let bugsSet = new Set();
  _cy.nodes().forEach((e) => {
    if (e.data()["properties"]["vulnerabilities"]) {
      e.data()["properties"]["vulnerabilities"]
        .forEach((bug) => {
          bugsSet.add(bug["analysis_name"])
        });
    }
  });


  let bugList = [...bugsSet]

  // Get the dropdown element.
  const dropdown = document.getElementById("tab-vulnerabilities");
  dropdown.innerHTML = "";

  bugList.forEach(bug => {
    const div = document.createElement("div");
    const label = document.createElement("label");
    label.setAttribute("for", `bug-${bug}`);
    label.setAttribute("class", "buglabel");

    const checkbox = document.createElement("input");
    checkbox.setAttribute("type", "checkbox");
    checkbox.setAttribute("id", `bug-${bug}`);
    checkbox.setAttribute("name", "showbugs");
    checkbox.setAttribute("onchange", "showBug(this)");
    checkbox.setAttribute("value", bug);

    const labelText = document.createTextNode(bug);
    label.appendChild(checkbox);
    label.appendChild(labelText);

    div.appendChild(label);
    dropdown.appendChild(div);
  });
};

function arrayIntersection(arr1, arr2) {
  const set2 = new Set(arr2);
  const result = arr1.filter(item => set2.has(item));
  return result;
}

// Highlight nodes berdasarkan query
const highlight = function (text) {
  if (text) {
    const classes = text.split(/[,\s]+/);
    cy.elements().addClass("dimmed");
    cy.elements(".hidden").removeClass("hidden").addClass("hidden");

    const cy_classes = cy.nodes().filter((node) => classes.includes(node.data('name')));
    const cy_edges = cy_classes.edgesWith(cy_classes);
    cy_classes.removeClass("dimmed");
    cy_edges.removeClass("dimmed");
    cy.nodes('[properties.kind = "package"]').removeClass("dimmed");
    cy.nodes('[properties.kind = "file"]').removeClass("dimmed");
  } else {
    cy.elements().removeClass("dimmed");
  }
  cy.edges(`[interaction = "${parentRel}"]`).style("display", "none");
};

const showRS = function (evt) {
  // console.log(evt.checked, evt.value);
  if (evt.checked) {
    cy.nodes(`[properties.rs = "${evt.value}"]`).removeClass("dimmed");
    cy.nodes(`[properties.rs = "${evt.value}"]`)
      .connectedEdges()
      .filter((e) => {
        return !e.source().hasClass("dimmed") && !e.target().hasClass("dimmed");
      })
      .removeClass("dimmed");
  } else {
    cy.nodes(`[properties.rs = "${evt.value}"]`).addClass("dimmed");
    cy.nodes(`[properties.rs = "${evt.value}"]`)
      .connectedEdges()
      .addClass("dimmed");
  }
};

const showTrace = function (evt) {

  const trace_names = [...document.getElementsByName("showfeatures")]
    .filter((e) => e.checked)
    .map((e) => e.value);

  [...document.getElementsByClassName("featurelabel")]
    .forEach((e) => { e.style.backgroundColor = ""; });

  if (trace_names.length > 0) {
    const colorMap = {};
    trace_names.forEach((trace, i) => {
      const label = document.querySelector(`label[for="feature-${trace}"]`);
      label.style.backgroundColor = ft_colors[i];
      colorMap[trace] = ft_colors[i];
    });

    const feature_nodes = cy.nodes().filter(function (node) {
      return trace_names.some((trace) => node.data("properties.traces") && node.data("properties.traces").includes(trace));
    });

    const feature_edges = cy.edges().filter(function (edge) {
      return trace_names.some((trace) => edge.data("properties.traces") && edge.data("properties.traces").includes(trace));
    });

    cy.elements().addClass("dimmed");
    cy.elements(".hidden").removeClass("hidden").addClass("hidden");
    feature_nodes.removeClass("dimmed");
    feature_edges.removeClass("dimmed");
    cy.nodes('[properties.kind = "package"]').removeClass("dimmed");
    feature_nodes.removeClass("feature_reset");
    feature_edges.removeClass("feature_reset");
    feature_nodes.addClass("feature_shown");
    feature_edges.addClass("feature_shown");

    feature_nodes.forEach((node) => {
      const trc = arrayIntersection(
        trace_names,
        node.data("properties.traces")
      );
      node.style(
        "background-gradient-stop-colors",
        trc.map((t) => colorMap[t]).join(" ")
      );
      // console.log(trc.map((t) => colorMap[t]).join(" "));
    });
  } else {
    cy.elements().removeClass("dimmed");
    cy.elements().removeClass("feature_shown");
    cy.elements().addClass("feature_reset");
  }
  cy.edges(`[interaction = "${parentRel}"]`).style("display", "none");
};

const showBug = function (evt) {

  const bug_names = [...document.getElementsByName("showbugs")]
    .filter((e) => e.checked)
    .map((e) => e.value);

  [...document.getElementsByClassName("buglabel")]
    .forEach((e) => { e.style.backgroundColor = ""; });

  if (bug_names.length > 0) {
    const colorMap = {};
    bug_names.forEach((bug, i) => {
      const labelElement = document.querySelector(`label[for="bug-${bug}"]`);
      labelElement.style.backgroundColor = ft_colors[i];
      colorMap[bug] = ft_colors[i];
    });

    const bug_nodes = cy.nodes().filter(function (node) {
      return bug_names.some((bug) => {
        try {
          return node.data()["properties"]["vulnerabilities"] && node.data()["properties"]["vulnerabilities"].some((e) => e["analysis_name"] === bug);
        } catch (e) {
        }
      });
    });

    cy.elements().addClass("dimmed");
    cy.elements(".hidden").removeClass("hidden").addClass("hidden");
    bug_nodes.removeClass("dimmed");

    cy.nodes('[properties.kind = "file"]').removeClass("dimmed");
    bug_nodes.removeClass("bug_reset");

    bug_nodes.addClass("bug_shown");

    bug_nodes.forEach((node) => {
      const trc = arrayIntersection(bug_names, node.data()["properties"]["vulnerabilities"].map((vul) => vul["analysis_name"]));
      node.style("background-gradient-stop-colors", trc.map((t) => colorMap[t]).join(" "));
      // console.log(trc.map((t) => colorMap[t]).join(" "));
    });
  } else {
    cy.elements().removeClass("dimmed");
    cy.elements().removeClass("bug_shown");
    cy.elements().addClass("bug_reset");
  }
  cy.edges(`[interaction = "${parentRel}"]`).style("display", "none");
};


function openSidebarTab(evt, cityName) {
  const tabs = document.getElementsByClassName("sidebar-tab");
  [...tabs].forEach(tab => {
    tab.style.display = "none";
  });

  const tablinks = document.getElementsByClassName("tablink");
  [...tablinks].forEach(tablink => {
    tablink.className = tablink.className.replace(" active", "");
  });

  document.getElementById(cityName).style.display = "block";
  evt.currentTarget.className += " active";
}

function bindPopper(target) {
  let tooltipId = `popper-target-${target.id()}`;
  let existingTarget = document.getElementById(tooltipId);
  if (existingTarget && existingTarget.length !== 0) {
    existingTarget.remove();
  }

  if (target.data()["properties"].hasOwnProperty('vulnerabilities') && target.data()["properties"]["vulnerabilities"].length > 0) {

    let popper = target.popper({
      content: () => {
        let tooltip = document.createElement('div');
        tooltip.id = tooltipId;
        tooltip.classList.add('target-popper');
        let targetData = target.data()["properties"]["vulnerabilities"];

        for (const [prop, targetValue] of Object.entries(targetData)) {
          const p = document.createElement('p');
          const vulnerabilities = target.data().properties.vulnerabilities[prop];
          p.innerText = `${vulnerabilities.analysis_name}: ${vulnerabilities.description}`;
          tooltip.appendChild(p);
        }

        document.body.appendChild(tooltip);

        return tooltip;
      },
      popper: {
        placement: "auto",
        options: {
          offset: [0, 40]
        }
      }
    });

    target.on("position", () => {
      popper.update();
    });

    target.cy().on("pan zoom resize", () => {
      popper.update();
    });


    /*target.on('mouseover', () => {
      if (!target.hasClass('dimmed')) {
        if (document.getElementById(tooltipId)) {
          document.getElementById(tooltipId).classList.remove("active");
        }
      }
    });*/
  }

  /*if (target.data()["properties"].hasOwnProperty("description")) {
    let popper = target.popper({
      content: () => {
        let tooltip = document.createElement('div');
        tooltip.id = tooltipId;
        tooltip.classList.add('target-popper');
        let desc = target.data()["properties"]["description"];
        tooltip.innerText = desc;

        document.body.appendChild(tooltip);

        return tooltip;
      },
      popper: {
        placement: "auto",
      },
    });

    target.on("position", () => {
      popper.update();
    });

    target.cy().on("pan zoom resize", () => {
      popper.update();
    });

    target
      .on("mouseover", () => {
        if (!target.hasClass("dimmed")) {
          if (document.getElementById(tooltipId)) {
            document.getElementById(tooltipId).classList.add("active");
          }
        }
      })
      .on("mouseout", () => {
        if (document.getElementById(tooltipId)) {
          document.getElementById(tooltipId).classList.remove("active");
        }
      });
  }*/
}
