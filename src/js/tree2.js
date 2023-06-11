// Create a dictionary to store the rectangle and course data
const rectDict = {};
const courseDict = {};

/**
 * Converts a spreadsheet at the given URL to JSON format.
 * @param {string} url - Link to the spreadsheet.
 * @returns {Promise<Object>} - JSON data representing the spreadsheet.
 */
async function spreadsheetToJson(url) {
	// Fetch the spreadsheet data
	const response = await fetch(url);
	const data = await response.arrayBuffer();

	// Read the workbook and worksheet from the data
	const workbook = XLSX.read(data, { type: "array" });
	const worksheet = workbook.Sheets[workbook.SheetNames[0]];

	// Define the range of rows and columns
	const range = XLSX.utils.decode_range(worksheet["!ref"]);
	range.s.r = 1;
	range.e.r = 21;
	range.s.c = 1;
	range.e.c = 9;

	// Convert the worksheet to JSON
	const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, range });
	const result = jsonData.slice(1).map(row => {
		const obj = {};
		jsonData[0].forEach((headerCell, index) => {
			obj[headerCell] = row[index];
		});
		return obj;
	});

	result.forEach(element => {
		element.parent = element.parent.toString() === "None" ?
			[] : element.parent.toString().split(", ");
		element.children = element.children.toString() === "None" ?
			[] : element.children.toString().split(", ");
	});
	return result;
}

/**
 * Generates a tree view of prerequisite tree from a JSON-like object.
 * @param {Object} rawData - Dictionary of course details.
 */
function generateTreeView(rawData) {
	const graphlib = dagreD3.graphlib;
	const render = dagreD3.render();

	const svg = d3.select("svg");
	const svgGroup = svg.append("g");

	const mainTree = new graphlib.Graph();
	mainTree.setGraph({ ranksep: 100 });
	mainTree.setDefaultEdgeLabel(() => ({}));

	// Create nodes and edges in the main tree
	for (const subject of rawData) {
		mainTree.setNode(subject.code, {
			label: subject.abbr,
			width: 50,
			height: 30,
			id: subject.abbr,
			class: `y${subject.year}`
		});

		subject.children.forEach(child => {
			mainTree.setEdge(subject.code, child, { class: `${subject.code}-${child}` });
		});
	}

	// Set rounded corners for the nodes
	mainTree.nodes().forEach(v => {
		const node = mainTree.node(v);
		node.rx = node.ry = 10;
	});

	render(d3.select("svg g"), mainTree);

	// Size the container to the graph
	svg.attr("width", mainTree.graph().width + 120);
	svg.attr("height", mainTree.graph().height + 120);

	svgGroup.attr("transform", `translate(${60}, ${60})`);
}

/**
 * Attaches event handlers to a node element.
 *
 * @param {string} abbr - The abbreviation associated with the node element.
 * @param {HTMLElement} nodeDiv - The node element to attach event handlers to.
 */
function attachEventHandlers(abbr, nodeDiv) {
	// Retrieve the subject data associated with the abbreviation
	const subjectData = courseDict[abbr];

	// Get the child and parent codes from the subject data
	const childCodes = subjectData.children.map(e => idToAbbr(e));
	const parentCodes = subjectData.parent.map(e => idToAbbr(e));

	// Event handler for mouse enter event
	const handleMouseEnter = () => {
		// Highlight the current node and its children and parents
		highlight(abbr);
		childCodes.forEach(code => highlight(code));
		parentCodes.forEach(code => highlight(code));
	};

	// Event handler for mouse leave event
	const handleMouseLeave = () => {
		// Revert the highlight of the current node and its children and parents
		highlight(abbr, false);
		childCodes.forEach(code => highlight(code, false));
		parentCodes.forEach(code => highlight(code, false));
	};

	// Event handler for click event
	const handleClick = () => {
		// Retrieve the course details associated with the abbreviation
		const course = courseDict[abbr];
		if (course) {
			// Log the clicked course and its details to the console
			console.log(`Course ${abbr} clicked!`);
			console.log("Course details:", course);
		}
	};

	// Attach event listeners to the node element
	nodeDiv.addEventListener("mouseenter", handleMouseEnter);
	nodeDiv.addEventListener("mouseleave", handleMouseLeave);
	nodeDiv.addEventListener("click", handleClick);
}

/**
 * Highlights or reverts the highlight of a rectangle element.
 *
 * @param {string} abbr - The abbreviation associated with the rectangle to be highlighted or reverted.
 * @param {boolean} isEnter - Indicates whether the mouse event is a mouse enter or mouse leave. Default is true (mouse enter).
 */
function highlight(abbr, isEnter = true) {
	// Retrieve the rectangle data associated with the abbreviation
	const rectData = rectDict[abbr];

	// Extract the necessary properties from the rectangle data
	const { newFill, newStroke, oldFill, oldStroke } = rectData;

	// Access the rectangle element in the DOM
	const rect = rectData.rectDiv;

	// Check if the highlight action is for mouse enter or mouse leave
	if (isEnter) {
		// Set the new fill and stroke color to highlight the rectangle
		rect.style.fill = newFill;
		rect.style.stroke = newStroke;
	} else {
		// Set the old fill and stroke color to revert the highlight
		rect.style.fill = oldFill;
		rect.style.stroke = oldStroke;
	}
}


/**
 * Converts an ID to its corresponding abbreviation.
 *
 * @param {string} id - The ID to be converted.
 * @returns {string} The corresponding abbreviation.
 */
function idToAbbr(id) {
	// Dictionary mapping IDs to abbreviations
	const abbrDict = {
		"204": "CS",
		"206": "Math",
		"208": "Stat"
	};

	// Extract the relevant part of the ID and combine it with the abbreviation
	return `${abbrDict[id.slice(0, 3)]}${id.slice(3)}`;
}


function main() {
	const spreadSheetUrl = "https://docs.google.com/spreadsheets/d/1t8dvUUdvOxdiKQv5nagGaHyiw3P-C2o0Qg6C_1Tlq58/edit#gid=0";

	// Convert the spreadsheet to JSON
	spreadsheetToJson(spreadSheetUrl).then(rawData => {
		// Generate the prerequisite tree view
		generateTreeView(rawData);

		// Populate the dictionary with rectangle and course data
		for (const subject of rawData) {
			const abbr = subject.abbr;
			rectDict[abbr] = {};
			courseDict[abbr] = subject;
		}

		// Set up the necessary properties for each rectangle element
		const nodeDivs = document.getElementsByClassName("node");
		Array.from(nodeDivs).forEach(div => {
			const [rect, text] = div.childNodes;
			const rectData = rectDict[div.id];

			Object.assign(rectData, {
				rectDiv: rect,
				textDiv: text,
				nodeDiv: div,
				oldFill: rect.style.fill,
				oldStroke: rect.style.stroke,
				newFill: "#ff0000",
				newStroke: "#ff0000"
			});
		});

		// Attach event handlers to the rectangles
		for (const [abbr, rectData] of Object.entries(rectDict)) {
			const { nodeDiv } = rectData;
			attachEventHandlers(abbr, nodeDiv);
		}

	});
}

main();
