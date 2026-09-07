<!-- Generated from src/shell.js by scripts/generate-framework-shells.mjs. Edit the shell source. -->
<script>
import { onMount } from 'svelte';
import { mountFrame } from '../../src/app.js';
let root;
onMount(() => mountFrame(root, { framework: 'svelte' }));
</script>
<div bind:this={root} class="frame-framework-host">
    <md-app-bar id="topbar" variant="search" class="topbar">
      <div slot="leading" class="brand-cluster">
        <md-tooltip text="Toggle navigation" position="bottom"><md-icon-button icon="menu" aria-label="Toggle navigation" data-action="navigation" id="nav-toggle"></md-icon-button></md-tooltip>
        <a class="brand" href="#/home" data-route="home" aria-label="Frame home"><span class="brand-mark"><span class="symbol" aria-hidden="true">play_arrow</span></span><span>frame<span class="brand-dot">.</span></span></a>
        <md-select id="framework-selector" class="framework-selector" label="Framework" aria-label="Framework" density="-2" value="svelte" variant="outlined">
          <md-select-option value="html">HTML</md-select-option><md-select-option value="react">React</md-select-option><md-select-option value="vue">Vue</md-select-option><md-select-option value="angular">Angular</md-select-option><md-select-option value="svelte">Svelte</md-select-option>
        </md-select>
      </div>
      <md-search slot="search" id="search" layout="docked" trigger="bar" full-width placeholder="Search videos, creators, and more" input-aria-label="Search videos" debounce="120" max-block-size="65vh">
        <div slot="results" id="search-results"></div>
      </md-search>
      <div slot="trailing" class="top-actions">
        <md-button variant="tonal" icon="add" data-action="upload" id="create-button">Create</md-button>
        <md-tooltip text="Appearance and components" position="bottom"><md-icon-button icon="tune" aria-label="Appearance and components" data-action="appearance" id="appearance-trigger"></md-icon-button></md-tooltip>
        <md-tooltip text="Your profile" position="bottom"><md-icon-button icon="person" aria-label="Your profile" data-action="profile" id="profile-trigger" class="profile-button"></md-icon-button></md-tooltip>
      </div>
    </md-app-bar>
    <md-progress-indicator id="action-progress" class="action-progress" variant="linear" indeterminate label="Working" hidden></md-progress-indicator>
    <div class="app-layout">
      <aside id="sidebar" class="sidebar">
        <md-navigation-rail id="rail" variant="expanded" active-index="0" label="Main navigation">
          <md-navigation-rail-tab icon="home" label="Home" value="home" href="#/home"></md-navigation-rail-tab><md-navigation-rail-tab icon="explore" label="Explore" value="explore" href="#/explore"></md-navigation-rail-tab><md-navigation-rail-tab icon="subscriptions" label="Subscriptions" value="subscriptions" href="#/subscriptions"></md-navigation-rail-tab><md-navigation-rail-tab icon="video_library" label="Your library" value="library" href="#/library"></md-navigation-rail-tab><md-navigation-rail-tab icon="history" label="History" value="history" href="#/history"></md-navigation-rail-tab><md-navigation-rail-tab icon="schedule" label="Watch later" value="saved" href="#/saved"></md-navigation-rail-tab><md-navigation-rail-tab icon="thumb_up" label="Liked videos" value="liked" href="#/liked"></md-navigation-rail-tab>
          <div slot="footer" class="sidebar-footer">
            <md-divider></md-divider>
            <div class="sidebar-section-heading">Subscriptions <span id="subscription-count"></span></div>
            <div id="sidebar-channels"></div>
            <md-divider></md-divider>
            <md-card class="library-callout" variant="filled">
              <span class="callout-icon"><span class="symbol" aria-hidden="true">widgets</span></span>
              <strong>Small components.<br>Big possibilities.</strong>
              <p>Built with AWC UI.</p>
              <md-button variant="text" trailing-icon="arrow_outward" data-action="appearance">Explore the details</md-button>
            </md-card>
            <p class="sidebar-legal">A little more worth watching.<br><span>Frame · An AWC UI showcase</span></p>
          </div>
        </md-navigation-rail>
      </aside>
      <main id="main" tabindex="-1"></main>
    </div>
    <md-navigation-bar id="mobile-nav" aria-label="Mobile navigation" manual-activation>
      <md-navigation-tab icon="home" label="Home"></md-navigation-tab><md-navigation-tab icon="explore" label="Explore"></md-navigation-tab><md-navigation-tab icon="subscriptions" label="Subscriptions"></md-navigation-tab><md-navigation-tab icon="video_library" label="Library"></md-navigation-tab>
    </md-navigation-bar>
    <md-snackbar id="toast" position="bottom" closeable auto-hide-duration="6000"></md-snackbar>
    <md-menu id="video-menu" placement="bottom-end" variant="standard" quick>
      <md-menu-item id="menu-save" headline="Save to Watch later" data-action="menu-save"><span slot="leading-icon" class="symbol">schedule</span></md-menu-item>
      <md-menu-item headline="Visit channel" data-action="menu-channel"><span slot="leading-icon" class="symbol">account_circle</span></md-menu-item>
      <md-menu-item headline="Share video" data-action="menu-share"><span slot="leading-icon" class="symbol">share</span></md-menu-item>
    </md-menu>
    <md-menu id="sort-menu" anchor="sort-button" placement="bottom-end" variant="standard" quick>
      <md-menu-item headline="Recommended" type="radio" selected data-action="sort-recommended"></md-menu-item>
      <md-menu-item headline="Most viewed" type="radio" data-action="sort-popular"></md-menu-item>
    </md-menu>
    <md-side-sheet id="appearance" variant="modal" headline="Make it yours" aria-label="Appearance and component showcase">
      <div class="settings-intro">One library. Your point of view.<p>See AWC UI’s design tokens transform the entire experience.</p></div>
      <section class="setting-section"><h3>Appearance</h3><md-segmented-button-set class="choice-row" id="theme-choices" aria-label="Theme">
        <md-segmented-button value="light" icon="light_mode" label="Light" data-theme-choice="light" ></md-segmented-button><md-segmented-button value="dark" icon="dark_mode" label="Dark" data-theme-choice="dark" selected></md-segmented-button><md-segmented-button value="system" icon="desktop_windows" label="System" data-theme-choice="system" ></md-segmented-button>
      </md-segmented-button-set></section>
      <section class="setting-section"><h3>Accent color</h3><md-segmented-button-set class="choice-row" id="accent-choices" aria-label="Accent color">
        <md-segmented-button value="red" label="Red" data-accent-choice="red" selected></md-segmented-button><md-segmented-button value="violet" label="Violet" data-accent-choice="violet" ></md-segmented-button><md-segmented-button value="blue" label="Blue" data-accent-choice="blue" ></md-segmented-button>
      </md-segmented-button-set></section>
      <md-divider></md-divider>
      <md-list class="settings-list" label="Playback and layout preferences" interaction-mode="multi-action">
        <md-list-item headline="Compact layout" supporting-text="A little more in every view." lines="2"><md-switch slot="trailing" data-pref="compact" aria-label="Compact layout"></md-switch></md-list-item>
        <md-list-item headline="Expressive motion" supporting-text="Ripple feedback and shape changes." lines="2"><md-switch slot="trailing" data-pref="motion" aria-label="Expressive motion"></md-switch></md-list-item>
        <md-list-item headline="Autoplay next video" supporting-text="Keep the good things going." lines="2"><md-switch slot="trailing" data-pref="autoplay" aria-label="Autoplay next video"></md-switch></md-list-item>
      </md-list>
      <md-divider></md-divider>
      <section class="component-story"><span class="eyebrow">Under the surface</span><h3>Native web components.<br>Working together.</h3><p>This app uses AWC UI for its navigation, search, cards, inputs, menus, dialogs, and feedback.</p><div id="component-census"></div><a href="https://awc-ui.dev" target="_blank" rel="noreferrer">Read the AWC UI documentation ↗</a></section>
    </md-side-sheet>
    <md-dialog id="share-dialog" headline="Share a good find" icon="share">
      <p>Send this video to someone who would love it.</p>
      <md-text-field id="share-url" label="Video link" name="videoLink" readonly variant="outlined"></md-text-field>
      <p class="muted">Local videos are only available in this browser. A local preview link works on this computer; deploy Frame to share its demo videos with others.</p>
      <md-button slot="actions" variant="text" data-action="close-share">Close</md-button><md-button slot="actions" data-action="copy-link" icon="content_copy"><md-progress-indicator slot="loader" variant="circular" indeterminate size="24" label="Copying link"></md-progress-indicator>Copy link</md-button>
    </md-dialog>
    <md-dialog id="upload-dialog" headline="Add your perspective" icon="video_call">
      <p>Add a video to your personal Frame library. The file stays in this browser; it isn’t uploaded to a server.</p>
      <div id="import-progress" class="import-progress" hidden><md-progress-indicator variant="linear" indeterminate label="Saving video to this browser"></md-progress-indicator><p>Saving your video in this browser… You can close this dialog while it finishes.</p></div>
      <form id="upload-form">
        <md-card variant="outlined" class="file-drop" id="file-drop"><span class="symbol" aria-hidden="true">cloud_upload</span><strong id="file-label">Choose a video to get started</strong><span>MP4, WebM, or MOV · up to 100 MB</span><md-button variant="tonal" data-action="choose-file">Select file</md-button><input id="file-input" type="file" accept="video/mp4,video/webm,video/quicktime" hidden></md-card>
        <md-text-field id="upload-title" label="Video title" name="title" required max-length="120" variant="outlined"></md-text-field>
        <md-text-field id="upload-description" label="Description" name="description" multiline="auto-grow" max-length="1000" variant="outlined"></md-text-field>
        <p id="upload-error" class="form-error" role="alert"></p>
      </form>
      <md-button slot="actions" variant="text" data-action="close-upload">Cancel</md-button><md-button slot="actions" id="upload-submit" data-action="submit-upload"><md-progress-indicator slot="loader" variant="circular" indeterminate size="24" label="Saving video"></md-progress-indicator>Add to library</md-button>
    </md-dialog>
    <md-dialog id="profile-dialog" headline="Your space on Frame">
      <div class="profile-summary"><md-avatar initials="YO" size="large"></md-avatar><div><strong>Curious by nature</strong><p>Your personal demo profile</p></div></div>
      <p>Likes, saved videos, subscriptions, comments, and your own videos are stored in this browser.</p><p class="muted">The discovery feed uses fictional creators and editorial titles. Sample playback footage is credited on every watch page.</p>
      <md-button slot="actions" variant="text" data-action="close-profile">Close</md-button><md-button slot="actions" data-action="profile-library">Your library</md-button>
    </md-dialog>
    <md-dialog id="clear-dialog" headline="Clear your watch history?" icon="history">
      <p>This removes your watch history from this browser. Your liked and saved videos will stay in your library.</p>
      <md-button slot="actions" variant="text" data-action="cancel-clear">Cancel</md-button><md-button slot="actions" data-action="confirm-clear">Clear history</md-button>
    </md-dialog></div>
