console.log('Twitter Multi-Mute Extension loaded');

(function () {
    'use strict';

    let presetWords = [];

    // Function to parse the presets file content
    function parsePresets(rawData) {
        // Remove any leading/trailing whitespace and the outer square brackets
        const trimmedData = rawData.trim().replace(/^\[|\];?$/g, '');

        // Split the string into individual preset arrays
        const presetStrings = trimmedData.split(/\],\s*\[/);

        return presetStrings.map(presetString => {
            // Remove any remaining square brackets
            const cleanedPresetString = presetString.replace(/^\[|\]$/g, '');

            // Split the string into individual items
            return cleanedPresetString.split(/,\s*/).map(item => {
                // Remove any quotes (single or double) from each item
                return item.replace(/^['"]|['"]$/g, '').trim();
            });
        });
    }

    // Function to fetch presets from GitHub
    async function fetchPresets() {
        const owner = 'cvarrasi';
        const repo = 'better-muted-words-twitter-extension';
        const path = 'presets';
        const branch = 'main';

        try {
            // First, get the file information from the GitHub API
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            // Get the raw content URL
            const rawUrl = data.download_url;

            // Fetch the raw content
            const rawResponse = await fetch(rawUrl);
            if (!rawResponse.ok) {
                throw new Error(`HTTP error! status: ${rawResponse.status}`);
            }
            const rawData = await rawResponse.text();

            // Parse the raw content using our custom parser
            presetWords = parsePresets(rawData);
            console.log('Presets loaded:', presetWords);
            updatePresetButtons(); // Add this line to update buttons after fetching
        } catch (error) {
            console.error('Error fetching presets:', error);
            // Fallback to default presets if fetch fails
            presetWords = [];
            updatePresetButtons(); // Still update buttons even if fetch fails
        }
    }

    function generateRelatedWords(input) {
        const phrases = input.split(/[,\n]/).map(phrase => phrase.trim()).filter(phrase => phrase !== '');
        const relatedWords = [];

        for (const phrase of phrases) {
            const words = phrase.split(/\s+/);

            if (words.length === 1) {
                // Single word rules
                const word = words[0];

                // Plural form
                relatedWords.push(word + 's');

                // Possessive form
                relatedWords.push(word + '\'s');

                // Letter swap just the first vowel
                relatedWords.push(word.replace(/[aeiou]/, '*'));

                // Letter swap just the first vowel  plural
                relatedWords.push((word.replace(/[aeiou]/, '*')) + 's');

                // L33t speak version
                relatedWords.push(word.replace(/a/gi, '4').replace(/e/gi, '3').replace(/i/gi, '1').replace(/o/gi, '0').replace(/s/gi, '5'));

                // L33t speak version plural
                relatedWords.push((word.replace(/a/gi, '4').replace(/e/gi, '3').replace(/i/gi, '1').replace(/o/gi, '0').replace(/s/gi, '5')) + 's');

                // Version with spaces between letters
                relatedWords.push(word.split('').join(' '));

                // Version with spaces between letters plural
                relatedWords.push((word.split('').join(' ')) + ' s');

                // For words ending with 'ism', add 'ist' and 'ists'
                if (word.endsWith('ism')) {
                    relatedWords.push(word.slice(0, -3) + 'ist');
                    relatedWords.push(word.slice(0, -3) + 'ists');
                }

            } else {
                // Multi-word phrase rules

                // Version without spaces
                relatedWords.push(words.join(''));

                // Version with spaces after each letter
                relatedWords.push(words.map(word => word.split('').join(' ')).join(' '));
            }
        }

        // Remove duplicates and original phrases
        return [...new Set(relatedWords.filter(w => !phrases.includes(w)))];
    }

    let lastProcessedText = '';

    function handleFindConnectedWords() {
        const wordList = document.getElementById('wordList');
        if (!wordList) {
            console.error('Word list textarea not found');
            return;
        }

        const currentText = wordList.value.trim();

        if (currentText.length === 0 || currentText === lastProcessedText) {
            return;
        }

        const newWords = generateRelatedWords(currentText);

        if (newWords.length > 0) {
            const updatedWordList = [...new Set([...currentText.split(/[,\n]/).map(w => w.trim()), ...newWords])];
            wordList.value = updatedWordList.join(', ');
            updateMuteButtonText();
            updateButtonStates();
        }

        lastProcessedText = wordList.value.trim();
        updateFindConnectedWordsButtonState();
    }

    function updateFindConnectedWordsButtonState() {
        const wordList = document.getElementById('wordList');
        const findConnectedWordsButton = document.getElementById('findConnectedWordsButton');

        if (wordList && findConnectedWordsButton) {
            const currentText = wordList.value.trim();
            findConnectedWordsButton.disabled = (currentText === lastProcessedText || currentText.length === 0);
        }
    }

    // New function to check if we're on the muted keywords page
    function isMutedKeywordsPage() {
        const path = window.location.pathname;
        const isCorrectPath = path.includes('/settings/muted_keywords') && 
                              !path.match(/\/settings\/muted_keywords\/\d+/);
        
        console.log('Current path:', path);
        console.log('Is correct path:', isCorrectPath);
    
        return isCorrectPath; // Only check the path for now
    }

    // New function to observe URL changes
    function observeUrlChanges(callback) {
        let lastUrl = window.location.href;
        const observer = new MutationObserver(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                lastUrl = currentUrl;
                callback(currentUrl);
            }
        });
        
        function observeMain() {
            const mainContent = document.querySelector('main[role="main"]');
            if (mainContent) {
                observer.observe(mainContent, { childList: true, subtree: true });
            } else {
                setTimeout(observeMain, 1000); // Retry after 1 second if main content is not found
            }
        }
        
        observeMain();
    }

    // New function to handle URL changes
    function onUrlChange(url) {
        if (isMutedKeywordsPage()) {
            fetchPresets().then(() => {
                retryInjectUI();
            });
        } else {
            const existingUI = document.getElementById('twitter-multi-mute');
            if (existingUI) {
                console.log('Removing UI as we are not on the main muted keywords page');
                existingUI.remove();
            }
        }
    }

    function injectUI() {
        console.log('Attempting to inject or remove UI');
        
        const existingUI = document.getElementById('twitter-multi-mute');
    
        if (!isMutedKeywordsPage()) {
            console.log('Not on muted keywords page, skipping injection');
            if (existingUI) {
                console.log('Removing UI as we are not on the main muted keywords page');
                existingUI.remove();
            }
            return false;
        }
        
        if (existingUI) {
            console.log('UI already injected');
            return true;
        }
    
        // Wait for the section details area to load
        const targetDiv = document.querySelector("#react-root > div > div > div.css-175oi2r.r-1f2l425.r-13qz1uu.r-417010.r-18u37iz > main > div > div > div > section:nth-child(2)");
        if (!targetDiv) {
            console.error('Section details area not found');
            return false;
        }
    
        console.log('Injecting UI');
        const extensionUI = document.createElement('div');
        extensionUI.id = 'twitter-multi-mute';
        extensionUI.className = 'twitter-multi-mute-container';
        extensionUI.innerHTML = `
        <div class="header-container">
            <h3>Multi-Mute Extension</h3>
            <button id="findConnectedWordsButton" title="Adds plurals, variants, letter swaps of the words you added. The originals will be preserved.">Add Plurals/Variants</button>
        </div>
        <div class="textarea-container">
            <textarea id="wordList" placeholder="Enter words to mute, separated by commas or new lines"></textarea>
            <button id="clearButton" class="clear-button">Clear</button>
        </div>
        <div id="carousel" class="carousel-container">
            <!-- Preset buttons will be added here dynamically -->
        </div>
        <div class="mute-button-container">
            <button id="muteButton" title="Adds the muted words you added to the text box above. The button shows the estimated number of seconds that the operation will take">Mute words</button>
        </div>
        <div id="statusContainer" style="display: none;"></div>
        <div id="loadingIndicator" style="display: none;">Processing... Please wait.</div>
        `;
    
        // Insert the extension UI as the first child of the target div
        targetDiv.insertBefore(extensionUI, targetDiv.firstChild);
        applyThemeClasses();
        copyBorderStyle();
    
        // Add event listeners and other initialization code here
        const muteButton = document.getElementById('muteButton');
        if (muteButton) {
            muteButton.addEventListener('click', handleMuteButtonClick);
            console.log('Click event listener added to mute button');
        } else {
            console.error('Mute button not found');
        }
    
        const findConnectedWordsButton = document.getElementById('findConnectedWordsButton');
        if (findConnectedWordsButton) {
            findConnectedWordsButton.addEventListener('click', handleFindConnectedWords);
            console.log('Click event listener added to Find Connected Words button');
        } else {
            console.error('Find Connected Words button not found');
        }
    
        const clearButton = document.getElementById('clearButton');
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                const wordList = document.getElementById('wordList');
                if (wordList) {
                    wordList.value = '';
                    adjustTextareaHeight(wordList);
                    updateMuteButtonText();
                    updateButtonStates();
                }
            });
            console.log('Click event listener added to clear button');
        } else {
            console.error('Clear button not found');
        }
    
        const wordList = document.getElementById('wordList');
        if (wordList) {
            wordList.addEventListener('input', function() {
                adjustTextareaHeight(this);
                updateMuteButtonText();
                updateButtonStates();
            });
            adjustTextareaHeight(wordList);
        } else {
            console.error('Word list textarea not found');
        }
    
        updatePresetButtons();
        adjustPresetButtonWidths();
        updateMuteButtonText();
        updateButtonStates();
    
        console.log('UI injected successfully');
        return true;
    }

    // New function to update preset buttons
    function updatePresetButtons() {
        const carousel = document.getElementById('carousel');
        if (!carousel) return;

        carousel.innerHTML = presetWords.map((preset, index) =>
            `<button class="small-preset-button" data-preset="${index}">${preset[0]}</button>`
        ).join('');

        // Re-add event listeners to preset buttons
        document.querySelectorAll('.small-preset-button').forEach((button) => {
            button.addEventListener('click', () => {
                const presetIndex = parseInt(button.getAttribute('data-preset'));
                const wordList = document.getElementById('wordList');
                if (wordList) {
                    wordList.value = presetWords[presetIndex].slice(1).join(', ');
                    adjustTextareaHeight(wordList);
                    updateMuteButtonText();
                    updateButtonStates();
                    console.log(`Preset "${presetWords[presetIndex][0]}" clicked, words set to: ${wordList.value}`);
                } else {
                    console.error('Word list textarea not found');
                }
            });
        });

        console.log('Preset buttons updated');
    }

    function retryInjectUI(maxRetries = 20, initialDelay = 1000, subsequentDelay = 500) {
        let retries = 0;
    
        function attemptInject() {
            console.log(`Attempt ${retries + 1} to inject UI`);
            if (isMutedKeywordsPage()) {
                const injected = injectUI();
                if (injected) {
                    console.log('UI injected successfully after retries');
                    return;
                }
            } else {
                console.log('Not on muted keywords page, skipping injection');
            }
    
            retries++;
            if (retries < maxRetries) {
                console.log(`Retry ${retries} scheduled in ${retries === 1 ? initialDelay : subsequentDelay}ms`);
                setTimeout(attemptInject, retries === 1 ? initialDelay : subsequentDelay);
            } else {
                console.error('Failed to inject UI after maximum retries');
            }
        }
    
        attemptInject();
    }

    function adjustPresetButtonWidths() {
        const buttons = document.querySelectorAll('.small-preset-button');
        buttons.forEach(button => {
            button.style.width = 'auto';
            button.style.width = `${button.offsetWidth}px`;
        });
    }

    function updatePresetButtons() {
        const carousel = document.getElementById('carousel');
        if (!carousel) return;

        carousel.innerHTML = presetWords.map((preset, index) =>
            `<button class="small-preset-button" data-preset="${index}">${preset[0]}</button>`
        ).join('');

        // Re-add event listeners to preset buttons
        document.querySelectorAll('.small-preset-button').forEach((button) => {
            button.addEventListener('click', () => {
                const presetIndex = parseInt(button.getAttribute('data-preset'));
                const wordList = document.getElementById('wordList');
                if (wordList) {
                    wordList.value = presetWords[presetIndex].slice(1).join(', ');
                    adjustTextareaHeight(wordList);
                    updateMuteButtonText();
                    updateButtonStates();
                    console.log(`Preset "${presetWords[presetIndex][0]}" clicked, words set to: ${wordList.value}`);
                } else {
                    console.error('Word list textarea not found');
                }
            });
        });

        console.log('Preset buttons updated');
    }

    function updateButtonStates() {
        const wordList = document.getElementById('wordList');
        const findConnectedWordsButton = document.getElementById('findConnectedWordsButton');
        const clearButton = document.getElementById('clearButton');

        if (wordList && findConnectedWordsButton && clearButton) {
            const currentText = wordList.value.trim();
            const isEmpty = currentText.length === 0;

            findConnectedWordsButton.disabled = (currentText === lastProcessedText || isEmpty);
            clearButton.disabled = isEmpty;
        }
    }

    function adjustTextareaHeight(textarea) {
        // Reset height to auto to get the correct scrollHeight
        textarea.style.height = 'auto';
        // Set the height to match the scrollHeight
        textarea.style.height = textarea.scrollHeight + 'px';
    }

    function handleMuteButtonClick() {
        console.log('Mute button clicked');
        const wordList = document.getElementById('wordList');
        if (!wordList) {
            console.error('Word list textarea not found');
            return;
        }
        const text = wordList.value;
        const words = text.split(/[,\n]/).map(word => word.trim()).filter(word => word !== '');
        console.log('Words to mute:', words);

        if (words.length === 0) {
            showStatus('Please enter at least one word to mute', 'error');
            return;
        }

        muteWords(words);
    }

    async function muteWords(words) {
        console.log('Attempting to mute words:', words);
        let addedWords = [];
        let skippedWords = [];
        let failedWords = [];

        clearAllStatus(); // Clear any existing status messages

        // Calculate estimated time
        const estimatedTime = Math.ceil(words.length * 1.5); // Assuming 1.5 seconds per word
        let remainingTime = estimatedTime;

        // Create and show modal overlay with countdown
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
        <div class="modal-content">
            <div class="spinner"></div>
            <p>Muting words...</p>
            <p id="countdownTimer">Estimated time remaining: ${remainingTime}s</p>
        </div>
    `;
        document.body.appendChild(overlay);

        const countdownTimer = overlay.querySelector('#countdownTimer');
        const countdownInterval = setInterval(() => {
            remainingTime = Math.max(0, remainingTime - 1);
            countdownTimer.textContent = `Estimated time remaining: ${remainingTime}s`;
        }, 1000);

        try {
            for (const word of words) {
                try {
                    const result = await addSingleWord(word);
                    if (result === 'added') {
                        addedWords.push(word);
                    } else if (result === 'skipped') {
                        skippedWords.push(word);
                    }
                } catch (error) {
                    console.error(`Failed to add word: ${word}`, error);
                    failedWords.push(word);
                }
            }

            if (skippedWords.length > 0) {
                showStatus(`${skippedWords.length} word${skippedWords.length > 1 ? 's' : ''} skipped (already muted): ${skippedWords.join(', ')}`, 'info');
            }

            // Wait for a short time before showing the second status message
            await new Promise(resolve => setTimeout(resolve, 100));

            if (addedWords.length > 0) {
                showStatus(`${addedWords.length} word${addedWords.length > 1 ? 's' : ''} successfully muted: ${addedWords.join(', ')}`, 'success');
            }

            if (failedWords.length > 0) {
                // Wait again before showing the failure message
                await new Promise(resolve => setTimeout(resolve, 100));
                showStatus(`Failed to add: ${failedWords.join(', ')}`, 'error');
            }

            // Clear the word list after muting
            const wordList = document.getElementById('wordList');
            if (wordList) {
                wordList.value = '';
                adjustTextareaHeight(wordList);
                updateMuteButtonText();
                updateButtonStates();
            }
        } finally {
            // Stop the countdown
            clearInterval(countdownInterval);
            // Remove the overlay
            document.body.removeChild(overlay);
        }
    }

    async function addSingleWord(word) {
        const addButton = await waitForElement('a[href="/settings/add_muted_keyword"][aria-label="Add muted word or phrase"]');
        addButton.click();

        const inputField = await waitForElement('input[name="keyword"]');
        inputField.value = word;
        inputField.dispatchEvent(new Event('input', { bubbles: true }));

        const saveButton = await waitForElement('button[data-testid="settingsDetailSave"]');
        saveButton.click();

        // Wait for either the success message or the "already muted" message
        await new Promise(resolve => setTimeout(resolve, 1000));

        const alreadyMutedMessage = document.querySelector("#react-root > div > div > div.css-175oi2r.r-1f2l425.r-13qz1uu.r-417010.r-18u37iz > main > div > div > div > section:nth-child(2) > div.css-175oi2r.r-qocrb3.r-kemksi.r-1h0z5md.r-1jx8gzb.r-f8sm7e.r-13qz1uu.r-1ye8kvj > div:nth-child(1) > div.css-175oi2r.r-1mmae3n.r-3pj75a > div > div > div:nth-child(2) > div > span");

        if (alreadyMutedMessage && alreadyMutedMessage.textContent.includes("You've already muted")) {
            console.log(`Word "${word}" is already muted. Skipping.`);
            // Close the dialog
            const closeButton = await waitForElement("#react-root > div > div > div.css-175oi2r.r-1f2l425.r-13qz1uu.r-417010.r-18u37iz > main > div > div > div > section:nth-child(2) > div.css-175oi2r.r-aqfbo4.r-gtdqiz.r-ipm5af.r-136ojw6 > div > div > div > div > div.css-175oi2r.r-1pz39u2.r-1777fci.r-15ysp7h.r-1habvwh.r-s8bhmr > button > div");
            closeButton.click();
            return 'skipped';
        }

        return 'added';
    }

    function waitForElement(selector, timeout = 10000, interval = 100) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            function checkElement() {
                const element = document.querySelector(selector);
                if (element) {
                    console.log(`Found element with selector: ${selector}`);
                    return resolve(element);
                }

                if (Date.now() - startTime > timeout) {
                    return reject(new Error(`Timeout waiting for element: ${selector}`));
                }

                setTimeout(checkElement, interval);
            }

            checkElement();
        });
    }

    function showStatus(message, type) {
        let statusContainer = document.getElementById('statusContainer');
        if (!statusContainer) {
            statusContainer = document.createElement('div');
            statusContainer.id = 'statusContainer';
            const extensionUI = document.getElementById('twitter-multi-mute');
            if (extensionUI) {
                extensionUI.appendChild(statusContainer);
            } else {
                return; // If the extension UI is not found, we can't show the status
            }
        }

        statusContainer.style.display = 'block';

        const statusDiv = document.createElement('div');
        statusDiv.textContent = message;
        statusDiv.className = `status ${type} visible`;
        statusContainer.appendChild(statusDiv);

        // Clear the status after 5 seconds
        setTimeout(() => {
            statusDiv.remove();
            if (statusContainer.children.length === 0) {
                statusContainer.style.display = 'none';
            }
        }, 5000);
    }

    function clearAllStatus() {
        const statusContainer = document.getElementById('statusContainer');
        if (statusContainer) {
            statusContainer.innerHTML = '';
            statusContainer.style.display = 'none';
        }
    }

    function updateMuteButtonText() {
        const wordList = document.getElementById('wordList');
        const muteButton = document.getElementById('muteButton');
        if (wordList && muteButton) {
            const words = wordList.value.split(/[,\n]/).map(word => word.trim()).filter(word => word !== '');
            const count = words.length;
            const estimatedTime = Math.ceil(count * 1.5); // Assuming 1 second per word
            muteButton.textContent = `Mute ${count} word${count !== 1 ? 's' : ''} (~${estimatedTime}s)`;
        }
    }

    // Cache for the custom menu item
    let cachedMenuItem = null;

    // Function to create the custom menu item
    // Updated function to create the custom menu item
    function createCustomMenuItem() {
        if (cachedMenuItem) return cachedMenuItem;

        // Find an existing menu item to clone
        const existingMenuItem = document.querySelector('div[role="menuitem"]');
        if (!existingMenuItem) {
            console.error('No existing menu item found to clone');
            return null;
        }

        // Clone the existing menu item
        const menuItem = existingMenuItem.cloneNode(true);
        menuItem.setAttribute('data-testid', 'ext-manage-muted-words');

        // Find the text content node and update it
        const textNode = menuItem.querySelector('span');
        if (textNode) {
            textNode.textContent = 'Mute keywords from this tweet';
        } else {
            console.error('Unable to find text node in cloned menu item');
        }

        // Update the icon (assuming the first SVG is the icon)
        const svgIcon = menuItem.querySelector('svg');
        if (svgIcon) {
            svgIcon.innerHTML = '<g><path d="M12 3.75c-4.55 0-8.25 3.69-8.25 8.25 0 1.92.66 3.68 1.75 5.08L17.09 5.5C15.68 4.4 13.92 3.75 12 3.75zm6.5 3.17L6.92 18.5c1.4 1.1 3.16 1.75 5.08 1.75 4.56 0 8.25-3.69 8.25-8.25 0-1.92-.65-3.68-1.75-5.08zM1.75 12C1.75 6.34 6.34 1.75 12 1.75S22.25 6.34 22.25 12 17.66 22.25 12 22.25 1.75 17.66 1.75 12z"></path></g>';
        } else {
            console.error('Unable to find SVG icon in cloned menu item');
        }

        // Update click event
        menuItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const menuContainer = findMenuContainer(e.target);
            if (!menuContainer) {
                console.error('Unable to find menu container');
                return;
            }

            const tweetElement = findClosestTweet(menuContainer);
            if (tweetElement) {
                const tweetWords = extractTweetText(tweetElement);
                openMutedWordsPage(tweetWords);
            } else {
                console.error('Unable to find tweet element');
            }
        });

        cachedMenuItem = menuItem;
        return menuItem;
    }

    // Function to insert the custom menu item
    function insertCustomMenuItem(menuElement) {
        if (!menuElement) return;

        if (menuElement.querySelector('[data-testid="ext-manage-muted-words"]')) return;

        // Check if this menu is the "More menu items" in the left navigation
        const moreMenuButton = menuElement.closest('div[aria-label="More menu items"]');
        if (moreMenuButton) {
            console.log('Skipping insertion for "More menu items"');
            return; // Exit the function without inserting the custom menu item
        }

        const menuItem = createCustomMenuItem();
        if (!menuItem) return;

        // Find the position to insert our item (e.g., after "Copy link to Tweet")
        const copyLinkItem = Array.from(menuElement.children).find(child =>
            child.textContent.includes('Copy link to Tweet')
        );

        if (copyLinkItem) {
            copyLinkItem.after(menuItem);
        } else {
            menuElement.appendChild(menuItem);
        }
    }

    // Function to handle menu opening
    function handleMenuOpening(menuElement) {
        if (!menuElement) return;
        insertCustomMenuItem(menuElement);
    }

    // Improved MutationObserver
    const menuObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                const addedNodes = Array.from(mutation.addedNodes);
                for (const node of addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const menuElement = node.querySelector('div[role="menu"]');
                        if (menuElement) {
                            handleMenuOpening(menuElement);
                            return;
                        }
                    }
                }
            }
        }
    });

    const observeTheme = new MutationObserver(() => {
        applyThemeClasses();
        copyBorderStyle(); // Add this line
    });
    observeTheme.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // Function to start observing for menus
    function observeForMenus() {
        menuObserver.observe(document.body, { childList: true, subtree: true });
    }

    // Function to initialize the extension
    function initExtension() {
        console.log('Initializing extension');
        observeForMenus();
        setupClickTracking();
        observeUrlChanges(onUrlChange);  // Add this line

        // Initial injection attempt if the URL matches
        if (isMutedKeywordsPage()) {
            fetchPresets().then(() => {
                retryInjectUI();
            });
        }

        console.log('Extension initialized');
    }

    // List of common words to filter out
    const commonWords = new Set([
        'a', 'about', 'above', 'after', 'against', 'all', 'also', 'am', 'an', 'and',
        'any', 'are', 'as', 'at', 'back', 'be', 'because', 'been', 'before', 'being',
        'below', 'between', 'both', 'but', 'by', 'can', 'come', 'could', 'day', 'did',
        'do', 'does', 'down', 'during', 'each', 'even', 'few', 'first', 'for', 'from',
        'get', 'give', 'go', 'good', 'had', 'has', 'have', 'he', 'her', 'here',
        'hers', 'him', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it',
        'its', 'just', 'know', 'like', 'look', 'make', 'many', 'may', 'me', 'might',
        'more', 'most', 'much', 'must', 'my', 'new', 'no', 'nor', 'not', 'now',
        'of', 'off', 'on', 'one', 'only', 'or', 'other', 'our', 'out', 'over',
        'own', 'people', 'say', 'see', 'she', 'should', 'so', 'some', 'such', 'take',
        'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'think',
        'this', 'those', 'through', 'time', 'to', 'too', 'two', 'under', 'up', 'us',
        'use', 'very', 'want', 'was', 'way', 'we', 'well', 'were', 'what', 'when',
        'where', 'which', 'who', 'whom', 'whose', 'why', 'will', 'with', 'would', 'year',
        'you', 'your', 'yours'
    ]);

    function extractTweetText(tweetElement) {
        console.log('Extracting text from tweet element:', tweetElement);

        const tweetTextElement = tweetElement.querySelector('[data-testid="tweetText"]');
        if (!tweetTextElement) {
            console.error('Unable to find tweetText element');
            return [];
        }

        const fullText = tweetTextElement.innerText;
        console.log('Full tweet text:', fullText);

        // Split the text into words and emojis
        const wordsAndEmojis = fullText.split(/\s+/)
            .map(item => {
                // If the item is an emoji (or multiple emojis), keep it as is
                if (/\p{Emoji}/u.test(item)) {
                    return item;
                }
                // Otherwise, process it as before
                return item.toLowerCase().replace(/[^a-z0-9]/g, '');
            })
            .filter(item => {
                // Keep the item if it's an emoji or if it's not a common word and not empty
                return /\p{Emoji}/u.test(item) || (item.length > 0 && !isCommonWord(item));
            });

        console.log('Filtered words and emojis:', wordsAndEmojis);
        return [...new Set(wordsAndEmojis)]; // Remove duplicates
    }

    // Update the isCommonWord function to always return false for emojis
    function isCommonWord(word) {
        // If the word contains an emoji, it's not a common word
        if (/\p{Emoji}/u.test(word)) {
            return false;
        }
        return commonWords.has(word) || word.length <= 2;
    }

    // Improved function to find the closest tweet element
    function findClosestTweet(menuElement) {
        console.log('Searching for tweet element starting from menu:', menuElement);

        // First, try to find the closest article element, which typically wraps the entire tweet
        let articleElement = menuElement.closest('article');

        if (articleElement) {
            console.log('Found article element:', articleElement);
            return articleElement;
        }

        // If we couldn't find an article, look for common parent elements
        let parentElement = menuElement.parentElement;
        while (parentElement && !parentElement.matches('section')) {
            parentElement = parentElement.parentElement;
        }

        if (parentElement) {
            console.log('Found section parent:', parentElement);
            // Look for the first child div that contains an article
            let tweetContainer = Array.from(parentElement.children).find(child =>
                child.tagName === 'DIV' && child.querySelector('article')
            );

            if (tweetContainer) {
                console.log('Found tweet container:', tweetContainer);
                return tweetContainer.querySelector('article');
            }
        }

        console.error('Unable to find tweet element');
        return null;
    }

    // Function to find the menu container
    function findMenuContainer(element) {
        console.log('Searching for menu container starting from:', element);
        while (element && !element.matches('[role="menu"]')) {
            element = element.parentElement;
        }
        console.log('Found menu container:', element);
        return element;
    }

    // Function to open muted words page with pre-filled text
    function openMutedWordsPage(words) {
        const prefixedText = "[Keywords from the tweet] " + words.join(', ');
        const encodedText = encodeURIComponent(prefixedText);
        window.open(`https://twitter.com/settings/muted_keywords#prefill=${encodedText}`, '_blank');
    }

    // Global variable to store the last clicked tweet
    let lastClickedTweet = null;

    // Function to handle clicks on the body
    function handleBodyClick(event) {
        console.log('Click event captured:', event.target);

        const article = event.target.closest('article');
        if (article) {
            lastClickedTweet = article;
            console.log('Click associated with tweet:', lastClickedTweet);
        } else {
            console.log('Click was not associated with a tweet');
        }
    }

    // Function to set up click tracking
    function setupClickTracking() {
        console.log('Setting up click tracking');
        document.body.addEventListener('click', handleBodyClick, true);
        console.log('Click event listener added to document body');
    }

    // Function to insert the custom menu item
    function insertCustomMenuItem(menuElement) {
        if (!menuElement) return;

        if (menuElement.querySelector('[data-testid="ext-manage-muted-words"]')) return;

        // Check if this menu contains a 'Monetization' item
        const hasMonetizationItem = Array.from(menuElement.children).some(child =>
            child.textContent.includes('Monetization')
        );

        // If 'Monetization' is present, this is likely the 'More' menu, so we skip insertion
        if (hasMonetizationItem) {
            console.log('Skipping insertion for "More" menu');
            return;
        }

        const menuItem = createCustomMenuItem();
        if (!menuItem) return;

        // Find the position to insert our item (e.g., after "Copy link to Tweet")
        const copyLinkItem = Array.from(menuElement.children).find(child =>
            child.textContent.includes('Copy link to Tweet')
        );

        if (copyLinkItem) {
            copyLinkItem.after(menuItem);
        } else {
            menuElement.appendChild(menuItem);
        }
    }

    // Updated function to create the custom menu item
    function createCustomMenuItem() {
        console.log('Creating custom menu item');
        if (cachedMenuItem) return cachedMenuItem;

        // Find an existing menu item to clone
        const existingMenuItem = document.querySelector('div[role="menuitem"]');
        if (!existingMenuItem) {
            console.error('No existing menu item found to clone');
            return null;
        }

        // Clone the existing menu item
        const menuItem = existingMenuItem.cloneNode(true);
        menuItem.setAttribute('data-testid', 'ext-manage-muted-words');

        // Find the text content node and update it
        const textNode = menuItem.querySelector('span');
        if (textNode) {
            textNode.textContent = 'Mute keywords from this tweet';
        } else {
            console.error('Unable to find text node in cloned menu item');
        }

        // Update the icon (assuming the first SVG is the icon)
        const svgIcon = menuItem.querySelector('svg');
        if (svgIcon) {
            svgIcon.innerHTML = '<g><path d="M12 3.75c-4.55 0-8.25 3.69-8.25 8.25 0 1.92.66 3.68 1.75 5.08L17.09 5.5C15.68 4.4 13.92 3.75 12 3.75zm6.5 3.17L6.92 18.5c1.4 1.1 3.16 1.75 5.08 1.75 4.56 0 8.25-3.69 8.25-8.25 0-1.92-.65-3.68-1.75-5.08zM1.75 12C1.75 6.34 6.34 1.75 12 1.75S22.25 6.34 22.25 12 17.66 22.25 12 22.25 1.75 17.66 1.75 12z"></path></g>';
        } else {
            console.error('Unable to find SVG icon in cloned menu item');
        }

        // Update click event
        menuItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            console.log('Custom menu item clicked');

            if (!lastClickedTweet) {
                console.error('No last clicked tweet found');
                alert('Sorry, we couldn\'t identify the tweet. Please try clicking on the tweet and opening the menu again.');
                return;
            }

            const tweetElement = lastClickedTweet;
            console.log('Processing tweet element:', tweetElement);
            const tweetWords = extractTweetText(tweetElement);
            console.log('Extracted words:', tweetWords);
            if (tweetWords.length > 0) {
                openMutedWordsPage(tweetWords);
            } else {
                alert('No suitable keywords found in this tweet. Try another tweet.');
            }

            // Reset lastClickedTweet after processing
            lastClickedTweet = null;
        });

        console.log('Custom menu item created');
        cachedMenuItem = menuItem;
        return menuItem;
    }

    function detectTheme() {
        const body = document.body;
        if (body.classList.contains('light-theme')) return 'light';
        if (body.classList.contains('dark-theme')) return 'dark';
        if (body.classList.contains('dim-theme')) return 'dim';

        // Fallback: check computed background color
        const bgColor = window.getComputedStyle(body).backgroundColor;
        if (bgColor === 'rgb(255, 255, 255)') return 'light';
        if (bgColor === 'rgb(21, 32, 43)') return 'dim';
        if (bgColor === 'rgb(0, 0, 0)') return 'dark';

        return 'light'; // default fallback
    }

    function applyThemeClasses() {
        const theme = detectTheme();
        const container = document.getElementById('twitter-multi-mute');
        if (container) {
            container.classList.remove('light-theme', 'dark-theme', 'dim-theme');
            container.classList.add(`${theme}-theme`);
        }

        // Update modal if it exists
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            modal.classList.remove('light-theme', 'dark-theme', 'dim-theme');
            modal.classList.add(`${theme}-theme`);
        }
    }

    function copyBorderStyle() {
        const sectionSelector = "#react-root > div > div > div.css-175oi2r.r-1f2l425.r-13qz1uu.r-417010.r-18u37iz > main > div > div > div > section.css-175oi2r.r-1kqtdi0.r-1ua6aaf.r-th6na.r-1phboty.r-1udh08x.r-13awgt0.r-f8sm7e.r-13qz1uu.r-1ye8kvj";
        const section = document.querySelector(sectionSelector);

        if (section) {
            const computedStyle = window.getComputedStyle(section);
            const borderStyle = computedStyle.border;

            const container = document.getElementById('twitter-multi-mute');
            if (container) {
                container.style.border = borderStyle;
            }
        }
    }

    // Call initExtension when the document is ready
    if (document.readyState === 'loading') {
        console.log('Document still loading, adding DOMContentLoaded listener');
        document.addEventListener('DOMContentLoaded', initExtension);
    } else {
        console.log('Document already loaded, initializing extension immediately');
        initExtension();
    }

    // Initial injection attempt if the URL matches
    if (isMutedKeywordsPage()) {
        fetchPresets().then(() => {
            retryInjectUI();
        });
    }

    // Observe URL changes
    observeUrlChanges((url) => {
        if (isMutedKeywordsPage()) {
            fetchPresets().then(() => {
                injectUI();
            });
        } else {
            const existingUI = document.getElementById('twitter-multi-mute');
            if (existingUI) {
                console.log('Removing UI as we are not on the main muted keywords page');
                existingUI.remove();
            }
        }
    });

    // Set up a MutationObserver to watch for container changes and try injecting again
    const observer = new MutationObserver(() => {
        if (isMutedKeywordsPage() && !document.getElementById('twitter-multi-mute')) {
            fetchPresets().then(() => {
                injectUI();
            });
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    document.body.addEventListener('click', () => {
        console.log('Body clicked, extension is active');
    }, { once: true });

    // Check if the document is already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initExtension);
    } else {
        initExtension();
    }
})();