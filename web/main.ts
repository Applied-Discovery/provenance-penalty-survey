// The one page every domain is served from. A domain folder holds only its manifest, artifacts and
// curation criteria; vite.config.ts serves this page at domains/<name>/, where runSurvey fetches
// ./domainManifest.json relative to the page URL.
import 'jspsych/css/jspsych.css';
import './style.css';   // after jsPsych's sheet, so its rules win
import { runSurvey, renderStartupFailure } from '../src/index';

runSurvey().catch(renderStartupFailure);
