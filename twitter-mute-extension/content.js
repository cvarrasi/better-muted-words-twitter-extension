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
        } catch (error) {
            console.error('Error fetching presets:', error);
            // Fallback to default presets if fetch fails
            presetWords = [
                ['🚫 Spam & Unwanted', 'spam', 'junk', 'irrelevant', 'ad', 'promotion', 'offensive', 'scam', 'fake', 'unwanted', 'clickbait'],
                ['🗳️ Politics', 'politics', 'election', 'candidate', 'vote', 'campaign', 'policy', 'government', 'debate', 'republican', 'democrat']
                // ... (other default presets)
            ];
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
        return path.includes('/settings/muted_keywords') && 
               !path.match(/\/settings\/muted_keywords\/\d+/);
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
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // New function to handle URL changes
    function onUrlChange(url) {
        if (isMutedKeywordsPage()) {
            injectUI();
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
            if (existingUI) {
                console.log('Removing UI as we are not on the main muted keywords page');
                existingUI.remove();
            }
            return;
        }
        
        if (existingUI) {
            console.log('UI already injected');
            return;
        }
    
        const containerSelector = '#react-root > div > div > div.css-175oi2r.r-1f2l425.r-13qz1uu.r-417010.r-18u37iz > main > div > div > div > section:nth-child(2) > div.css-175oi2r.r-qocrb3.r-kemksi.r-1h0z5md.r-1jx8gzb.r-f8sm7e.r-13qz1uu.r-1ye8kvj';
        const container = document.querySelector(containerSelector);
    
        if (!container) {
            console.error('Container not found');
            return;
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
            ${presetWords.map((preset, index) => `<button class="small-preset-button" data-preset="${index}">${preset[0]}</button>`).join('')}
        </div>
        <div class="mute-button-container">
            <button id="muteButton" title="Adds the muted words you added to the text box above. The button shows the estimated number of seconds that the operation will take">Mute words</button>
        </div>
        <div id="statusContainer" style="display: none;"></div>
        <div id="loadingIndicator" style="display: none;">Processing... Please wait.</div>
        `;

        // Insert the extension UI as the first child of the container
        container.insertBefore(extensionUI, container.firstChild);
    
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
    
        // Add event listeners to preset buttons
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
    
        const wordList = document.getElementById('wordList');
        if (wordList) {
            wordList.addEventListener('input', function() {
                adjustTextareaHeight(this);
                updateMuteButtonText();
                updateButtonStates();
            });
            adjustTextareaHeight(wordList);
        }
    
        updateMuteButtonText(); // Set initial button text
        updateButtonStates(); // Set initial button states
    
        adjustPresetButtonWidths();
    
        // Remove any bottom margin
        extensionUI.style.marginBottom = '0';
    
        console.log('UI injected successfully');
    }

    function adjustPresetButtonWidths() {
        const buttons = document.querySelectorAll('.small-preset-button');
        buttons.forEach(button => {
            button.style.width = 'auto';
            button.style.width = `${button.offsetWidth}px`;
        });
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

    // Initial injection attempt if the URL matches
    if (isMutedKeywordsPage()) {
        fetchPresets().then(() => {
            injectUI();
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
            injectUI();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();