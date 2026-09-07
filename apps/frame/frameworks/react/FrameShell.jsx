// Generated from src/shell.js by scripts/generate-framework-shells.mjs. Edit the shell source.
import { useLayoutEffect, useRef } from 'react';
import { mountFrame } from '../../src/app.js';
export function FrameShell() {
  const root = useRef(null);
  useLayoutEffect(() => mountFrame(root.current, { framework: 'react' }), []);
  return <div ref={root} className="frame-framework-host">{"\n    "}
<md-app-bar id={"topbar"} variant={"search"} class={"topbar"}>
{"\n      "}
<div slot={"leading"} className={"brand-cluster"}>
{"\n        "}
<md-tooltip text={"Toggle navigation"} position={"bottom"}>
<md-icon-button icon={"menu"} aria-label={"Toggle navigation"} data-action={"navigation"} id={"nav-toggle"} />
</md-tooltip>
{"\n        "}
<a className={"brand"} href={"#/home"} data-route={"home"} aria-label={"Frame home"}>
<span className={"brand-mark"}>
<span className={"symbol"} aria-hidden={"true"}>
{"play_arrow"}
</span>
</span>
<span>
{"frame"}
<span className={"brand-dot"}>
{"."}
</span>
</span>
</a>
{"\n        "}
<md-select id={"framework-selector"} class={"framework-selector"} label={"Framework"} aria-label={"Framework"} density={"-2"} value={"react"} variant={"outlined"}>
{"\n          "}
<md-select-option value={"html"}>
{"HTML"}
</md-select-option>
<md-select-option value={"react"}>
{"React"}
</md-select-option>
<md-select-option value={"vue"}>
{"Vue"}
</md-select-option>
<md-select-option value={"angular"}>
{"Angular"}
</md-select-option>
<md-select-option value={"svelte"}>
{"Svelte"}
</md-select-option>
{"\n        "}
</md-select>
{"\n      "}
</div>
{"\n      "}
<md-search slot={"search"} id={"search"} layout={"docked"} trigger={"bar"} full-width={""} placeholder={"Search videos, creators, and more"} input-aria-label={"Search videos"} debounce={"120"} max-block-size={"65vh"}>
{"\n        "}
<div slot={"results"} id={"search-results"} />
{"\n      "}
</md-search>
{"\n      "}
<div slot={"trailing"} className={"top-actions"}>
{"\n        "}
<md-button variant={"tonal"} icon={"add"} data-action={"upload"} id={"create-button"}>
{"Create"}
</md-button>
{"\n        "}
<md-tooltip text={"Appearance and components"} position={"bottom"}>
<md-icon-button icon={"tune"} aria-label={"Appearance and components"} data-action={"appearance"} id={"appearance-trigger"} />
</md-tooltip>
{"\n        "}
<md-tooltip text={"Your profile"} position={"bottom"}>
<md-icon-button icon={"person"} aria-label={"Your profile"} data-action={"profile"} id={"profile-trigger"} class={"profile-button"} />
</md-tooltip>
{"\n      "}
</div>
{"\n    "}
</md-app-bar>
{"\n    "}
<md-progress-indicator id={"action-progress"} class={"action-progress"} variant={"linear"} indeterminate={""} label={"Working"} hidden={""} />
{"\n    "}
<div className={"app-layout"}>
{"\n      "}
<aside id={"sidebar"} className={"sidebar"}>
{"\n        "}
<md-navigation-rail id={"rail"} variant={"expanded"} active-index={"0"} label={"Main navigation"}>
{"\n          "}
<md-navigation-rail-tab icon={"home"} label={"Home"} value={"home"} href={"#/home"} />
<md-navigation-rail-tab icon={"explore"} label={"Explore"} value={"explore"} href={"#/explore"} />
<md-navigation-rail-tab icon={"subscriptions"} label={"Subscriptions"} value={"subscriptions"} href={"#/subscriptions"} />
<md-navigation-rail-tab icon={"video_library"} label={"Your library"} value={"library"} href={"#/library"} />
<md-navigation-rail-tab icon={"history"} label={"History"} value={"history"} href={"#/history"} />
<md-navigation-rail-tab icon={"schedule"} label={"Watch later"} value={"saved"} href={"#/saved"} />
<md-navigation-rail-tab icon={"thumb_up"} label={"Liked videos"} value={"liked"} href={"#/liked"} />
{"\n          "}
<div slot={"footer"} className={"sidebar-footer"}>
{"\n            "}
<md-divider />
{"\n            "}
<div className={"sidebar-section-heading"}>
{"Subscriptions "}
<span id={"subscription-count"} />
</div>
{"\n            "}
<div id={"sidebar-channels"} />
{"\n            "}
<md-divider />
{"\n            "}
<md-card class={"library-callout"} variant={"filled"}>
{"\n              "}
<span className={"callout-icon"}>
<span className={"symbol"} aria-hidden={"true"}>
{"widgets"}
</span>
</span>
{"\n              "}
<strong>
{"Small components."}
<br />
{"Big possibilities."}
</strong>
{"\n              "}
<p>
{"Built with AWC UI."}
</p>
{"\n              "}
<md-button variant={"text"} trailing-icon={"arrow_outward"} data-action={"appearance"}>
{"Explore the details"}
</md-button>
{"\n            "}
</md-card>
{"\n            "}
<p className={"sidebar-legal"}>
{"A little more worth watching."}
<br />
<span>
{"Frame · An AWC UI showcase"}
</span>
</p>
{"\n          "}
</div>
{"\n        "}
</md-navigation-rail>
{"\n      "}
</aside>
{"\n      "}
<main id={"main"} tabIndex={"-1"} />
{"\n    "}
</div>
{"\n    "}
<md-navigation-bar id={"mobile-nav"} aria-label={"Mobile navigation"} manual-activation={""}>
{"\n      "}
<md-navigation-tab icon={"home"} label={"Home"} />
<md-navigation-tab icon={"explore"} label={"Explore"} />
<md-navigation-tab icon={"subscriptions"} label={"Subscriptions"} />
<md-navigation-tab icon={"video_library"} label={"Library"} />
{"\n    "}
</md-navigation-bar>
{"\n    "}
<md-snackbar id={"toast"} position={"bottom"} closeable={""} auto-hide-duration={"6000"} />
{"\n    "}
<md-menu id={"video-menu"} placement={"bottom-end"} variant={"standard"} quick={""}>
{"\n      "}
<md-menu-item id={"menu-save"} headline={"Save to Watch later"} data-action={"menu-save"}>
<span slot={"leading-icon"} className={"symbol"}>
{"schedule"}
</span>
</md-menu-item>
{"\n      "}
<md-menu-item headline={"Visit channel"} data-action={"menu-channel"}>
<span slot={"leading-icon"} className={"symbol"}>
{"account_circle"}
</span>
</md-menu-item>
{"\n      "}
<md-menu-item headline={"Share video"} data-action={"menu-share"}>
<span slot={"leading-icon"} className={"symbol"}>
{"share"}
</span>
</md-menu-item>
{"\n    "}
</md-menu>
{"\n    "}
<md-menu id={"sort-menu"} anchor={"sort-button"} placement={"bottom-end"} variant={"standard"} quick={""}>
{"\n      "}
<md-menu-item headline={"Recommended"} type={"radio"} selected={""} data-action={"sort-recommended"} />
{"\n      "}
<md-menu-item headline={"Most viewed"} type={"radio"} data-action={"sort-popular"} />
{"\n    "}
</md-menu>
{"\n    "}
<md-side-sheet id={"appearance"} variant={"modal"} headline={"Make it yours"} aria-label={"Appearance and component showcase"}>
{"\n      "}
<div className={"settings-intro"}>
{"One library. Your point of view."}
<p>
{"See AWC UI’s design tokens transform the entire experience."}
</p>
</div>
{"\n      "}
<section className={"setting-section"}>
<h3>
{"Appearance"}
</h3>
<md-segmented-button-set class={"choice-row"} id={"theme-choices"} aria-label={"Theme"}>
{"\n        "}
<md-segmented-button value={"light"} icon={"light_mode"} label={"Light"} data-theme-choice={"light"} />
<md-segmented-button value={"dark"} icon={"dark_mode"} label={"Dark"} data-theme-choice={"dark"} selected={""} />
<md-segmented-button value={"system"} icon={"desktop_windows"} label={"System"} data-theme-choice={"system"} />
{"\n      "}
</md-segmented-button-set>
</section>
{"\n      "}
<section className={"setting-section"}>
<h3>
{"Accent color"}
</h3>
<md-segmented-button-set class={"choice-row"} id={"accent-choices"} aria-label={"Accent color"}>
{"\n        "}
<md-segmented-button value={"red"} label={"Red"} data-accent-choice={"red"} selected={""} />
<md-segmented-button value={"violet"} label={"Violet"} data-accent-choice={"violet"} />
<md-segmented-button value={"blue"} label={"Blue"} data-accent-choice={"blue"} />
{"\n      "}
</md-segmented-button-set>
</section>
{"\n      "}
<md-divider />
{"\n      "}
<md-list class={"settings-list"} label={"Playback and layout preferences"} interaction-mode={"multi-action"}>
{"\n        "}
<md-list-item headline={"Compact layout"} supporting-text={"A little more in every view."} lines={"2"}>
<md-switch slot={"trailing"} data-pref={"compact"} aria-label={"Compact layout"} />
</md-list-item>
{"\n        "}
<md-list-item headline={"Expressive motion"} supporting-text={"Ripple feedback and shape changes."} lines={"2"}>
<md-switch slot={"trailing"} data-pref={"motion"} aria-label={"Expressive motion"} />
</md-list-item>
{"\n        "}
<md-list-item headline={"Autoplay next video"} supporting-text={"Keep the good things going."} lines={"2"}>
<md-switch slot={"trailing"} data-pref={"autoplay"} aria-label={"Autoplay next video"} />
</md-list-item>
{"\n      "}
</md-list>
{"\n      "}
<md-divider />
{"\n      "}
<section className={"component-story"}>
<span className={"eyebrow"}>
{"Under the surface"}
</span>
<h3>
{"Native web components."}
<br />
{"Working together."}
</h3>
<p>
{"This app uses AWC UI for its navigation, search, cards, inputs, menus, dialogs, and feedback."}
</p>
<div id={"component-census"} />
<a href={"https://awc-ui.dev"} target={"_blank"} rel={"noreferrer"}>
{"Read the AWC UI documentation ↗"}
</a>
</section>
{"\n    "}
</md-side-sheet>
{"\n    "}
<md-dialog id={"share-dialog"} headline={"Share a good find"} icon={"share"}>
{"\n      "}
<p>
{"Send this video to someone who would love it."}
</p>
{"\n      "}
<md-text-field id={"share-url"} label={"Video link"} name={"videoLink"} readonly={""} variant={"outlined"} />
{"\n      "}
<p className={"muted"}>
{"Local videos are only available in this browser. A local preview link works on this computer; deploy Frame to share its demo videos with others."}
</p>
{"\n      "}
<md-button slot={"actions"} variant={"text"} data-action={"close-share"}>
{"Close"}
</md-button>
<md-button slot={"actions"} data-action={"copy-link"} icon={"content_copy"}>
<md-progress-indicator slot={"loader"} variant={"circular"} indeterminate={""} size={"24"} label={"Copying link"} />
{"Copy link"}
</md-button>
{"\n    "}
</md-dialog>
{"\n    "}
<md-dialog id={"upload-dialog"} headline={"Add your perspective"} icon={"video_call"}>
{"\n      "}
<p>
{"Add a video to your personal Frame library. The file stays in this browser; it isn’t uploaded to a server."}
</p>
{"\n      "}
<div id={"import-progress"} className={"import-progress"} hidden={true}>
<md-progress-indicator variant={"linear"} indeterminate={""} label={"Saving video to this browser"} />
<p>
{"Saving your video in this browser… You can close this dialog while it finishes."}
</p>
</div>
{"\n      "}
<form id={"upload-form"}>
{"\n        "}
<md-card variant={"outlined"} class={"file-drop"} id={"file-drop"}>
<span className={"symbol"} aria-hidden={"true"}>
{"cloud_upload"}
</span>
<strong id={"file-label"}>
{"Choose a video to get started"}
</strong>
<span>
{"MP4, WebM, or MOV · up to 100 MB"}
</span>
<md-button variant={"tonal"} data-action={"choose-file"}>
{"Select file"}
</md-button>
<input id={"file-input"} type={"file"} accept={"video/mp4,video/webm,video/quicktime"} hidden={true} />
</md-card>
{"\n        "}
<md-text-field id={"upload-title"} label={"Video title"} name={"title"} required={""} max-length={"120"} variant={"outlined"} />
{"\n        "}
<md-text-field id={"upload-description"} label={"Description"} name={"description"} multiline={"auto-grow"} max-length={"1000"} variant={"outlined"} />
{"\n        "}
<p id={"upload-error"} className={"form-error"} role={"alert"} />
{"\n      "}
</form>
{"\n      "}
<md-button slot={"actions"} variant={"text"} data-action={"close-upload"}>
{"Cancel"}
</md-button>
<md-button slot={"actions"} id={"upload-submit"} data-action={"submit-upload"}>
<md-progress-indicator slot={"loader"} variant={"circular"} indeterminate={""} size={"24"} label={"Saving video"} />
{"Add to library"}
</md-button>
{"\n    "}
</md-dialog>
{"\n    "}
<md-dialog id={"profile-dialog"} headline={"Your space on Frame"}>
{"\n      "}
<div className={"profile-summary"}>
<md-avatar initials={"YO"} size={"large"} />
<div>
<strong>
{"Curious by nature"}
</strong>
<p>
{"Your personal demo profile"}
</p>
</div>
</div>
{"\n      "}
<p>
{"Likes, saved videos, subscriptions, comments, and your own videos are stored in this browser."}
</p>
<p className={"muted"}>
{"The discovery feed uses fictional creators and editorial titles. Sample playback footage is credited on every watch page."}
</p>
{"\n      "}
<md-button slot={"actions"} variant={"text"} data-action={"close-profile"}>
{"Close"}
</md-button>
<md-button slot={"actions"} data-action={"profile-library"}>
{"Your library"}
</md-button>
{"\n    "}
</md-dialog>
{"\n    "}
<md-dialog id={"clear-dialog"} headline={"Clear your watch history?"} icon={"history"}>
{"\n      "}
<p>
{"This removes your watch history from this browser. Your liked and saved videos will stay in your library."}
</p>
{"\n      "}
<md-button slot={"actions"} variant={"text"} data-action={"cancel-clear"}>
{"Cancel"}
</md-button>
<md-button slot={"actions"} data-action={"confirm-clear"}>
{"Clear history"}
</md-button>
{"\n    "}
</md-dialog></div>;
}
