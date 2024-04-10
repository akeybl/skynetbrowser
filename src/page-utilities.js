const { randomDelay } = require('./utilities.js');
const Fuse = require('fuse.js');

const interactive = ["link", "button", "combobox", "searchbox", "textbox", "select", "menuitem", "menuitemcheckbox", "menuitemradio", "radio", "checkbox", "option", "slider", "spinbutton", "switch", "tab", "treeitem"];

async function clickElement(page, cursor, element) {
    const intersecting = await element.isIntersectingViewport();

    if (!intersecting) {
        await randomDelay(500, 1500);
        element.scrollIntoView();
        await randomDelay(500, 1500);
    }

    await randomDelay(500, 1500);

    const boundingBox = await element.boundingBox();
    // Calculate the minimum and maximum values for the insideX range
    const minX = boundingBox.x + boundingBox.width / 4;
    const maxX = boundingBox.x + 3 * boundingBox.width / 4;
    // Generate a random value within the range [minX, maxX] for insideX
    const insideX = minX + Math.random() * (maxX - minX);

    // Calculate the minimum and maximum values for the insideY range
    const minY = boundingBox.y + boundingBox.height / 4;
    const maxY = boundingBox.y + 3 * boundingBox.height / 4;
    // Generate a random value within the range [minY, maxY] for insideY
    const insideY = minY + Math.random() * (maxY - minY);

    // console.log(`Clicking ${element} at (${insideX},${insideY})`);

    await cursor.moveTo({ x: insideX, y: insideY });
    // await page.mouse.move(insideX, insideY);

    await randomDelay(30, 200);

    // await cursor.click(element)
    // await page.mouse.click(insideX, insideY);
    await element.tap();
}

async function keyboardType(page, text) {
    console.log(`Typing: ${text}`)
    for (let char of text) {
        // Generating a random delay between 30 and 100 milliseconds
        await randomDelay(20, 40);
        await page.keyboard.type(char);
    }
}

async function keyboardPress(page, key, frame = null) {
    console.log(`Hitting: ${key}`)

    if (frame) {
        await frame.focus('body');
    }

    await randomDelay(1000, 3000);
    await page.keyboard.press(key);
}

async function selectAll(page, frame = null) {
    console.log(`Selecting all`);

    if (frame) {
        await frame.focus('body');
    }

    await page.keyboard.press('Home');
    await randomDelay(100, 200);
    await page.keyboard.down('Shift');
    await randomDelay(100, 200);
    await page.keyboard.press('PageDown');
    await randomDelay(100, 200);
    await page.keyboard.up('Shift');
    await randomDelay(100, 200);
}

async function queryAXTree(
    client, //: CDPSession,
    accessibleName //, //?: string,
    // role //?: string
) {
    // XXX: Add back in role here
    const { root } = await client.send('DOM.getDocument', { depth: 0 });
    const { nodes } = await client.send('Accessibility.queryAXTree', {
        backendNodeId: root.backendNodeId,
        accessibleName: accessibleName //,
        // role: role
    });
    const filteredNodes = nodes.filter( //: Protocol.Accessibility.AXNode[] = nodes.filter(
        (node) => { //: Protocol.Accessibility.AXNode) => {
            return !node.role || node.role.value !== 'StaticText';
        }
    );
    return filteredNodes;
}

async function getAriaElement(client, page, cursor, label) {
    const axNodes = await queryAXTree(client, label);

    // console.log(axNodes);

    if (axNodes.length > 0) {
        const backendNodeId = axNodes[0].backendDOMNodeId;
        // console.log(backendNodeId);

        const htmlElement = await page.$("html");
        return await htmlElement.realm.adoptBackendNode(backendNodeId);
    }
    else {
        throw new Error(`Unable to find ARIA with label: ${label}`)
    }
}

async function clickClosestAriaName(client, page, cursor, label) {
    var frameIdToFrame = await getAllFrames(page);
    var nodeTree = await buildTree(client, frameIdToFrame);
    var nameToElementsMap = await mapNameToElements(nodeTree);
    // console.log(nameToElementsMap);

    var elementIndex = 0;
    const regex = /#(\d+)#/;
    const match = label.match(regex);

    if (match) {
        label = label.replace(match[0], "");
        elementIndex = parseInt(match[1], 10) - 1;
    }

    const matchingKeys = Object.keys(nameToElementsMap).filter(key => key.includes(label));

    if (matchingKeys.length == 1 && ( match || nameToElementsMap[matchingKeys[0]].length == 1) ) {
        console.log('One exact match:', matchingKeys[0]);

        const element = nameToElementsMap[matchingKeys[0]][elementIndex];
        await clickElement(page, cursor, element);
        return;
    }

    const items = Object.entries(nameToElementsMap).map(([key, value]) => ({ key, value }));

    const fuse = new Fuse(items, {
        keys: ['key'], // specify the property to search against
        includeScore: true // include the search score in the result
    });

    // Search for the closest key
    const result = fuse.search(label);

    if (result.length > 0) {
        console.log('Closest match:', result[0].item.key, 'with score:', result[0].score);

        if (result[0].score < 0.5) {
            const element = nameToElementsMap[result[0].item.key][elementIndex];
            await clickElement(page, cursor, element);    
        }
        else {
            throw new Error(`No match found for ${label}. Closest match was ${result[0].item.key}.`);
        }
    } else {
        throw new Error(`No match found for ${label}.`);
    }
    // XXX: NEED TO FINISH
}

async function clickExactAriaName(client, page, cursor, label) {
    const ariaElement = await getAriaElement(client, page, cursor, label);

    if (ariaElement) {
        await clickElement(page, cursor, ariaElement);
    }
    else {
        console.log(`Couldn't find element with label "${label}"`);
    }
}

async function buildTree(client, frameIdToFrame, frameTree = null, nodeIdToNode = null, rootNodeId = null, frameTopElement = null, nodeId = null) {
    if (frameTree === null) {
        frameTree = await client.send(
            'Accessibility.getFullAXTree',
        );
    }

    if (nodeIdToNode === null) {
        nodeIdToNode = frameTree.nodes.reduce((acc, item) => {
            acc[item.nodeId] = item;
            return acc;
        }, {});
    }

    if (rootNodeId === null) {
        const rootNode = frameTree.nodes.filter(node => !node.parentId)[0];
        rootNodeId = rootNode.nodeId;
    }

    if (frameTopElement === null) {
        const frame = frameIdToFrame[nodeIdToNode[rootNodeId].frameId];
        frameTopElement = await frame.$("html");
    }

    if (nodeId === null) {
        nodeId = rootNodeId;
    }

    const nodeClone = { ...nodeIdToNode[nodeId] };
    nodeClone.frameId = nodeIdToNode[rootNodeId].frameId;
    nodeClone.children = [];

    if (nodeClone.backendDOMNodeId) {
        nodeClone.element = await frameTopElement.realm.adoptBackendNode(nodeClone.backendDOMNodeId);
    }

    if (nodeId == rootNodeId) {
        console.log(`Processing frameId: ${nodeClone.frameId}`);
    }

    for (let childId of nodeClone.childIds) {
        const childNode = nodeIdToNode[childId];

        if (childNode.role.value === "Iframe") {
            const iFrameNodeDescribed = await client.send("DOM.describeNode", {
                backendNodeId: childNode.backendDOMNodeId,
            });

            const iFrameNodeFrameTree = await client.send("Accessibility.getFullAXTree", {
                frameId: iFrameNodeDescribed.node.frameId,
            });

            nodeClone.children.push(await buildTree(client, frameIdToFrame, iFrameNodeFrameTree));
        }
        else {
            nodeClone.children.push(await buildTree(client, frameIdToFrame, frameTree, nodeIdToNode, rootNodeId, frameTopElement, childId));
        }
    }

    if (interactive.includes(nodeClone.role.value) || nodeClone.role.value == "image") {
        if (!nodeClone.name) {
            nodeClone.name = {};
        }

        var fnt = getFullNodeText(nodeClone).join(" ").trim();

        if (fnt == null || fnt == "") {
            fnt = "unnamed";
        }

        nodeClone.name.value = fnt;
        // console.log(nodeClone.name.value);

        nodeClone.children = [];
    }

    return nodeClone;
}

async function getAllFrames(page) {
    var frames = [];

    for (let frame of page.frames()) {
        await getChildFrames(frames, frame);
    }

    frameIdToFrame = frames.reduce((acc, item) => {
        acc[item._id] = item;
        return acc;
    }, {});

    return frameIdToFrame;
}

async function getChildFrames(frames, frame) {
    if (!frames.includes(frame)) {
        frames.push(frame);
    }

    for (let childFrame of frame.childFrames()) {
        await getChildFrames(frames, childFrame);
    }
}

async function mapNameToElements(node) {
    let map = {};

    function traverse(node) {
        if (!node) return;
        // if (node.ignored) return;
        // console.log(node);

        if (interactive.includes(node.role.value) && node.element != null && node.element != {}) {
            var key = `${node.role.value}: ${node.name?.value.trim()}`;

            if (!map[key]) {
                map[key] = [];
            }
            map[key].push(node.element);
        }

        // If the node has children, traverse them recursively
        if (node.children && node.children.length > 0) {
            node.children.forEach(child => {
                traverse(child);
            });
        }
    }

    traverse(node); // Start the traversal from the root node

    return map;
}

async function getAriaElementsText(client, page, includeURLs) {
    var frameIdToFrame = await getAllFrames(page);
    var nodeTree = await buildTree(client, frameIdToFrame);
    var treeText = await getTreeText(nodeTree, 0, includeURLs);

    let counts = {};

    const addNumberToRepeatingStrings = (array) => {
        // First pass to count occurrences and store indices
        array.forEach((item, index) => {
            let matches = item.match(/{([^:]+):\s*(.*)}(.*)/);
            if (matches) {
                let identifier = `${matches[1]}: ${matches[2]}`;
                if (!counts[identifier]) {
                    counts[identifier] = { count: 1, indices: [index] };
                } else {
                    counts[identifier].count++;
                    counts[identifier].indices.push(index);
                }
            }
        });
    
        // Second pass to number items based on counts and indices
        return array.map((item, index) => {
            let matches = item.match(/{([^:]+):\s*(.*)}(.*)/);
            if (matches) {
                let identifier = `${matches[1]}: ${matches[2]}`;
                if (counts[identifier].count > 1) {
                    // Find the index of this occurrence
                    let occurrenceIndex = counts[identifier].indices.indexOf(index) + 1; // +1 to make it human-readable (1-based indexing)
                    if (matches[2] == "") {
                        return `{${matches[1]}: #${occurrenceIndex}#}${matches[3]}`;
                    }
                    else {
                        return `{${matches[1]}: ${matches[2]} #${occurrenceIndex}#}${matches[3]}`;
                    }
                }
            }
            return item; // Return the original item if it's not repeated
        });
    };
    
    const treeTextWithNumbers = addNumberToRepeatingStrings(treeText);
    const treeTextWithNumbersStr = treeTextWithNumbers.join("\n");

    return treeTextWithNumbersStr.replace(/\n+/g, '\n');
}

function getFullNodeText(node) {
    var nodeTextArray = [];

    // if (node.role && node.role.value == "image") {
    //     if (node.name && node.name.value) {
    //         nodeTextArray.push(`![${node.name.value}]()`.trim());
    //     }
    //     else {
    //         nodeTextArray.push("![]()");
    //     }
    // }
    // else 
    if (node.name && node.name.value && !node.ignored) {
        nodeTextArray.push(node.name.value);
        // console.log(`XXX: ${node.name.value}`);
    }
    else {
        nodeTextArray.push("");
    }

    for (let childNode of node.children) {
        const childNodeTextArray = getFullNodeText(childNode);
        nodeTextArray = nodeTextArray.concat(childNodeTextArray);
    }

    const uniqueArray = [...new Set(nodeTextArray)];
    return uniqueArray;
}

async function getTreeText(node, level, includeURLs) {
    var fullTextArray = [];

    const editable = ["searchbox", "combobox", "textbox"];
    const checkable = ["checkbox", "menuitemcheckbox", "radio", "switch"];
    const selectable = ["switch", "tab", "treeitem"];
    const hasURL = ["link", "button"];

    if (!node.ignored && node.role && node.role.value) {
        if (hasURL.includes(node.role.value)) {
            let href = await node.element.evaluate(el => el.getAttribute('href'));

            if (href && includeURLs) {
                href = href.replace("https://www.", "");
                href = href.replace("http://www.", "");
                href = href.replace("https://", "");
                href = href.replace("http://", "");

                if (href.length > 40) {
                    href = `${href.substring(0, 40)}...`;
                }

                fullTextArray.push(`{${node.role.value}: ${node.name.value}}(${href})`);
            }
            else {
                fullTextArray.push(`{${node.role.value}: ${node.name.value}}`);
            }
        }
        else if (interactive.includes(node.role.value)) { // && node.element !== null) {
            if (node.element === null || (node.element !== null && node.element.isVisible())) {
                var focusStr = "";
                var editableValueStr = "";

                if (node.properties !== null) {
                    if (editable.includes(node.role.value)) {
                        for (let property of node.properties) {
                            if (property.name == "focused" && property.value.value) {
                                focusStr = "► ";
                            }
                        }
                    }
                    else if (checkable.includes(node.role.value)) {
                        for (let property of node.properties) {
                            if (property.name == "checked" && property.value.value) {
                                // console.log(property.value);
                                focusStr = "☑ ";
                                break;
                            }
                        }
                    }
                    else if (selectable.includes(node.role.value)) {
                        for (let property of node.properties) {
                            if (property.name == "selected" && property.value.value) {
                                // console.log(property.value);
                                focusStr = "☑ ";
                                break;
                            }
                        }
                    }
                }

                if (editable.includes(node.role.value)) {
                    // editableValueStr = `\n${" ".repeat(level+1)}StaticText: ${node.value.value}`
                    if (node.value && node.value.value) {
                        editableValueStr = `[${node.value.value}]`;
                    }
                    else {
                        editableValueStr = `[]`;
                    }
                }

                fullTextArray.push(`{${focusStr}${node.role.value}: ${node.name.value}}${editableValueStr}\n`);
            }
            else {
                for (let childNode of node.children) {
                    fullTextArray = fullTextArray.concat(await getTreeText(childNode, level, includeURLs));
                }
            }
        }
        else {
            var text = "";

            if (node.role.value == "RootWebArea") {
                text = `# START ${node.name.value}`;
            }
            else if (node.role.value == "heading") {
                var heading_level = 1;

                for (let property of node.properties) {
                    if (property.name == "level" && property.value.value) {
                        heading_level = property.value.value;
                    }
                }

                text = "#".repeat(heading_level) + " " + node.name.value;
            }
            else if (node.name && node.name.value) {
                // text = `${node.role.value}: ${node.name.value}`;
                text = `${node.name.value}`;
            }

            if (text.trim() != "") {
                // fullText += `${" ".repeat(level+1)}${text}\n`;
                fullTextArray.push(`${text}\n`);
            }

            for (let childNode of node.children) {
                fullTextArray = fullTextArray.concat(await getTreeText(childNode, level + 1, includeURLs));
            }

            if (node.role.value == "RootWebArea") {
                fullTextArray.push(`# END ${node.name.value}\n`);
            }
        }
    }
    else {
        for (let childNode of node.children) {
            fullTextArray = fullTextArray.concat(await getTreeText(childNode, level, includeURLs));
        }
    }

    return fullTextArray;
}

module.exports = { clickElement, clickExactAriaName, getAriaElement, keyboardPress, keyboardType, selectAll, getAriaElementsText, clickClosestAriaName };
