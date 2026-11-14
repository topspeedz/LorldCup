import {create as character} from './character.js';
import {create as screenVideo} from './screen-video.js';
import {create as seatMode} from './seat-mode.js';
import {create as environment} from './environment.js';
import {create as skyShow} from './sky-show.js';
import {create as stageMonitors} from './stage-monitors.js';
import {create as stagePlayers} from './stage-players.js';
import {create as nameplate} from './nameplate.js';
import {create as hud} from './ui/hud.js';
import {create as teamSelect} from './ui/team-select.js';
import {create as emoteMenu} from './ui/emote-menu.js';
import {create as ticket} from './ui/ticket.js';
import {create as fullMode} from './ui/full-mode.js';
import {create as chat} from './ui/chat.js';
import {create as invite} from './ui/invite.js';
import {create as arenaFixes} from './arena-fixes.js';
import {create as ticketStaff} from './ticket-staff.js';

export const modules=[
 {path:'character.js',create:character},
 {path:'screen-video.js',create:screenVideo},
 {path:'seat-mode.js',create:seatMode},
 {path:'environment.js',create:environment},
 {path:'sky-show.js',create:skyShow},
 {path:'stage-monitors.js',create:stageMonitors},
 {path:'stage-players.js',create:stagePlayers},
 {path:'nameplate.js',create:nameplate},
 {path:'ui/hud.js',create:hud},
 {path:'ui/team-select.js',create:teamSelect},
 {path:'ui/emote-menu.js',create:emoteMenu},
 {path:'ui/ticket.js',create:ticket},
 {path:'ui/full-mode.js',create:fullMode},
 {path:'ui/chat.js',create:chat},
 {path:'ui/invite.js',create:invite},
 {path:'arena-fixes.js',create:arenaFixes},
 {path:'ticket-staff.js',create:ticketStaff},
];
