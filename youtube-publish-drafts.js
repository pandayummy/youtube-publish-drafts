// --- START OF FILE youtube-publish-drafts.txt ---

(() => {
    // -----------------------------------------------------------------
    // CONFIG (you're safe to edit this)
    // -----------------------------------------------------------------
    // ~ GLOBAL CONFIG
    // -----------------------------------------------------------------
    const MODE = 'publish_drafts'; // 'publish_drafts' / 'sort_playlist';
    const DEBUG_MODE = true; // true / false, enable for more context
    // -----------------------------------------------------------------
    // ~ PUBLISH CONFIG
    // -----------------------------------------------------------------
    const MADE_FOR_KIDS = false; // true / false;
    const VISIBILITY = 'Public'; // 'Public' / 'Private' / 'Unlisted'
    // -----------------------------------------------------------------
    // ~ SORT PLAYLIST CONFIG
    // -----------------------------------------------------------------
    const SORTING_KEY = (one, other) => {
        return one.name.localeCompare(other.name, undefined, {numeric: true, sensitivity: 'base'});
    };
    // END OF CONFIG (not safe to edit stuff below)
    // -----------------------------------------------------------------

    // Art by Joan G. Stark
    // .'"'.        ___,,,___        .'``.
    // : (\  `."'"```         ```"'"-'  /) ;
    //  :  \                         `./  .'
    //   `.                            :.'
    //     /        _         _        \
    //    |         0}       {0         |
    //    |         /         \         |
    //    |        /           \        |
    //    |       /             \       |
    //     \     |      .-.      |     /
    //      `.   | . . /   \ . . |   .'
    //        `-._\.'.(     ).'./_.-'
    //            `\'  `._.'  '/'
    //              `. --'-- .'
    //                `-...-'



    // ----------------------------------
    // COMMON  STUFF
    // ---------------------------------
    const TIMEOUT_STEP_MS = 20;
    const DEFAULT_ELEMENT_TIMEOUT_MS = 15000;
    function debugLog(...args) {
        if (!DEBUG_MODE) {
            return;
        }
        console.log(...args);
    }
    const sleep = (ms) => new Promise((resolve, _) => setTimeout(resolve, ms));

    async function waitForElement(selector, baseEl, timeoutMs) {
        if (timeoutMs === undefined) {
            timeoutMs = DEFAULT_ELEMENT_TIMEOUT_MS;
        }
        if (baseEl === undefined) {
            baseEl = document;
        }
        let timeout = timeoutMs;
        while (timeout > 0) {
            // baseEl can be null if a previous waitForElement failed.
            if (!baseEl) {
                 debugLog(`waitForElement received a null baseEl for selector: ${selector}`);
                 return null;
            }
            let element = baseEl.querySelector(selector);
            if (element !== null) {
                return element;
            }
            await sleep(TIMEOUT_STEP_MS);
            timeout -= TIMEOUT_STEP_MS;
        }
        debugLog(`could not find ${selector} inside`, baseEl);
        return null;
    }

    function click(element) {
        const event = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        element.dispatchEvent(event);
        debugLog(element, 'clicked');
    }

    // ----------------------------------
    // PUBLISH STUFF
    // ----------------------------------
    const VISIBILITY_PUBLISH_ORDER = {
        'Private': 0,
        'Unlisted': 1,
        'Public': 2,
    };

    // SELECTORS
    // ---------
    const VIDEO_ROW_SELECTOR = 'ytcp-video-row';
    const DRAFT_MODAL_SELECTOR = 'ytcp-uploads-dialog';
    const DRAFT_BUTTON_SELECTOR = '.edit-draft-button';
    const RADIO_BUTTON_SELECTOR = 'tp-yt-paper-radio-button';
    const VISIBILITY_STEPPER_SELECTOR = '#step-badge-3';
    const VISIBILITY_PAPER_BUTTONS_SELECTOR = 'tp-yt-paper-radio-group';
    const SAVE_BUTTON_SELECTOR = '#done-button';
    const SUCCESS_ELEMENT_SELECTOR = 'ytcp-video-thumbnail-with-info';
    const DIALOG_SELECTOR = 'ytcp-dialog.ytcp-video-share-dialog > tp-yt-paper-dialog:nth-child(1)';
    const DIALOG_CLOSE_BUTTON_SELECTOR = '#close-icon-button';
    
    // ----- THIS IS THE FIX for "Made for Kids" -----
    const MFK_YES_SELECTOR = 'tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_MFK"]';
    const MFK_NO_SELECTOR = 'tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]';
    // -----------------------------------------------

    class SuccessDialog {
        constructor(raw) {
            this.raw = raw;
        }

        async closeDialogButton() {
            return await waitForElement(DIALOG_CLOSE_BUTTON_SELECTOR, this.raw);
        }
        
        async isClosed() {
            let timeout = DEFAULT_ELEMENT_TIMEOUT_MS;
            while (timeout > 0) {
                if (!document.body.contains(this.raw)) {
                    return true;
                }
                await sleep(TIMEOUT_STEP_MS);
                timeout -= TIMEOUT_STEP_MS;
            }
            return false;
        }

        async close() {
            const closeButton = await this.closeDialogButton();
            if (closeButton) {
                click(closeButton);
                await this.isClosed();
                debugLog('Confirmation dialog closed.');
            } else {
                console.error("Could not find the close button for the success dialog.");
            }
        }
    }

    class VisibilityModal {
        constructor(raw) {
            this.raw = raw;
        }

        async radioButtonGroup() {
            return await waitForElement(VISIBILITY_PAPER_BUTTONS_SELECTOR, this.raw);
        }

        async visibilityRadioButton() {
            const group = await this.radioButtonGroup();
            const value = VISIBILITY_PUBLISH_ORDER[VISIBILITY];
            return [...group.querySelectorAll(RADIO_BUTTON_SELECTOR)][value];
        }

        async setVisibility() {
            click(await this.visibilityRadioButton());
            debugLog(`visibility set to ${VISIBILITY}`);
            await sleep(50);
        }

        async saveButton() {
            return await waitForElement(SAVE_BUTTON_SELECTOR, this.raw);
        }
        async isSaved() {
            return await waitForElement(DIALOG_SELECTOR, document);
        }

        async save() {
            click(await this.saveButton());
            const dialogElement = await this.isSaved();
            debugLog('saved, confirmation dialog appeared');
            if (dialogElement) {
                return new SuccessDialog(dialogElement);
            }
            return null;
        }
    }

    class DraftModal {
        constructor(raw) {
            this.raw = raw;
        }
        
        // --- REPLACED LOGIC ---
        // The old madeForKidsToggle and madeForKidsPaperButton methods were removed
        // as they were the source of the error. This new method is more direct.
        async selectMadeForKids() {
            const selector = MADE_FOR_KIDS ? MFK_YES_SELECTOR : MFK_NO_SELECTOR;
            debugLog(`Attempting to select "Made for kids": ${MADE_FOR_KIDS} using selector: ${selector}`);
            
            const radioButton = await waitForElement(selector, this.raw);

            if (radioButton) {
                if (radioButton.hasAttribute('checked')) {
                    debugLog(`"Made for kids" is already set correctly. Skipping.`);
                    return;
                }
                click(radioButton);
                await sleep(100);
                debugLog(`"Made for kids" set as ${MADE_FOR_KIDS}`);
            } else {
                const errorMessage = `Could not find the "Made for kids" radio button. The script cannot continue.`;
                console.error(errorMessage);
                alert(errorMessage); // Alert the user so they see the issue immediately
                throw new Error(errorMessage);
            }
        }

        async visibilityStepper() {
            return await waitForElement(VISIBILITY_STEPPER_SELECTOR, this.raw);
        }

        async goToVisibility() {
            debugLog('going to Visibility');
            await sleep(50);
            click(await this.visibilityStepper());
            const visibility = new VisibilityModal(this.raw);
            await sleep(50);
            await waitForElement(VISIBILITY_PAPER_BUTTONS_SELECTOR, visibility.raw);
            return visibility;
        }
    }

    class VideoRow {
        constructor(raw) {
            this.raw = raw;
        }

        get editDraftButton() {
            return waitForElement(DRAFT_BUTTON_SELECTOR, this.raw, 20);
        }

        async openDraft() {
            debugLog('Opening draft editor...');
            const draftButton = await this.editDraftButton;
            if (draftButton) {
                click(draftButton);
                const modal = await waitForElement(DRAFT_MODAL_SELECTOR);
                if (modal) {
                    return new DraftModal(modal);
                }
            }
            throw new Error("Could not open the draft editor modal.");
        }
    }


    function allVideos() {
        return [...document.querySelectorAll(VIDEO_ROW_SELECTOR)].map((el) => new VideoRow(el));
    }

    async function editableVideos() {
        let editable = [];
        for (let video of allVideos()) {
            if ((await video.editDraftButton) !== null) {
                editable = [...editable, video];
            }
        }
        return editable;
    }

    async function publishDrafts() {
        try {
            const videos = await editableVideos();
            debugLog(`found ${videos.length} videos to publish`);
            if(videos.length === 0) {
                console.log("No draft videos found on this page.");
                return;
            }
            debugLog('starting in 2000ms');
            await sleep(2000);
            
            let count = 1;
            for (let video of videos) {
                console.log(`%cPublishing video ${count} of ${videos.length}...`, 'font-weight: bold; color: blue;');
                const draft = await video.openDraft();
                await draft.selectMadeForKids();
                const visibility = await draft.goToVisibility();
                await visibility.setVisibility();
                const dialog = await visibility.save();
                if (dialog) {
                    await dialog.close();
                } else {
                    console.error("Failed to get success dialog, cannot close. Aborting.");
                    break;
                }
                await sleep(500);
                count++;
            }
            console.log("%cAll draft videos on the page have been processed successfully!", 'font-weight: bold; color: green;');
        } catch (error) {
            console.error("An error occurred during the publishing process:", error);
            alert("Script stopped due to an error. Check the console (F12) for details.");
        }
    }

    // ----------------------------------
    // SORTING STUFF
    // ... (sorting code is unchanged) ...
    // ----------------------------------
    const SORTING_MENU_BUTTON_SELECTOR = 'button';
    const SORTING_ITEM_MENU_SELECTOR = 'tp-yt-paper-listbox#items';
    const SORTING_ITEM_MENU_ITEM_SELECTOR = 'ytd-menu-service-item-renderer';
    const MOVE_TO_TOP_INDEX = 4;
    const MOVE_TO_BOTTOM_INDEX = 5;
    class SortingDialog{constructor(e){this.raw=e}async anyMenuItem(){const e=await waitForElement(SORTING_ITEM_MENU_ITEM_SELECTOR,this.raw);if(null===e)throw new Error("could not locate any menu item");return e}menuItems(){return[...this.raw.querySelectorAll(SORTING_ITEM_MENU_ITEM_SELECTOR)]}async moveToTop(){click(this.menuItems()[MOVE_TO_TOP_INDEX])}async moveToBottom(){click(this.menuItems()[MOVE_TO_BOTTOM_INDEX])}}
    class PlaylistVideo{constructor(e){this.raw=e}get name(){return this.raw.querySelector("#video-title").textContent}async dialog(){return this.raw.querySelector(SORTING_MENU_BUTTON_SELECTOR)}async openDialog(){click(await this.dialog());const e=new SortingDialog(await waitForElement(SORTING_ITEM_MENU_SELECTOR));return await e.anyMenuItem(),e}}
    async function playlistVideos(){return[...document.querySelectorAll("ytd-playlist-video-renderer")].map(e=>new PlaylistVideo(e))}
    async function sortPlaylist(){debugLog("sorting playlist");const e=await playlistVideos();debugLog(`found ${e.length} videos`),e.sort(SORTING_KEY);const t=e.map(e=>e.name);let o=1;for(let s of t){debugLog({index:o,name:s});const t=e.find(e=>e.name===s),r=await t.openDialog();await r.moveToBottom(),await sleep(1e3),o+=1}}

    // ----------------------------------
    // ENTRY POINT
    // ----------------------------------
    ({
        'publish_drafts': publishDrafts,
        'sort_playlist': sortPlaylist,
    })[MODE]();

})();
