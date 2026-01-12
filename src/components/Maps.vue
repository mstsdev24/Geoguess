<template>
    <div
        id="container-map"
        :class="[
            ($viewport.width >= 450 && (activeMap || pinActive)) ||
                isMakeGuessButtonClicked ||
                isNextButtonVisible
                ? 'container-map--active'
                : '',
            printMapFull ? 'container-map--full' : '',
            `container-map--size-${size}`,
        ]"
        v-on="
            $viewport.width >= 450 // Only on tablet and desktop Issue #104
                ? {
                    mouseover: () => {
                        activeMap = true;
                    },
                    mouseleave: () => {
                        activeMap = false;
                    },
                }
                : {}
        "
    >
        <div class="container-map_details">
            <!-- AI Result -->
            <div
              v-if="aiResult"
              class="ai-result-box"
            >
              <h3>{{ $t('Maps.ai.title') }}</h3>
              <p>
                {{ $t('Maps.ai.distance', {
                  value: Math.floor(aiResult.distance / 1000)
                }) }}
              </p>
              <p class="ai-reason">
                {{ 
                  $t('Maps.ai.reason', {
                    reason: aiResult.reason
                  })
                }}
              </p>
            </div>

            <div class="alert-container">
                <Leaderboard
                    v-if="!$vuetify.breakpoint.mobile && leaderboardShown && printMapFull"
                    :leaderboard-shown="leaderboardShown"
                ></Leaderboard>
            </div>
            <DetailsMap
                v-if="printMapFull"
                :properties="randomFeatureProperties"
            />
        </div>

        <div class="container-map_controls">
            <div class="container-map_btns">
                <v-btn fab x-small @click="showNotepad">
                    <v-icon dark> mdi-file-document-edit </v-icon>
                </v-btn>

                <v-btn
                    id="btnDown"
                    fab
                    x-small
                    :disabled="size < 2"
                    @click="size--"
                >
                    <v-icon dark> mdi-arrow-bottom-left </v-icon>
                </v-btn>

                <v-btn
                    id="btnUp"
                    fab
                    x-small
                    :disabled="size > 3"
                    @click="size++"
                >
                    <v-icon dark> mdi-arrow-top-right </v-icon>
                </v-btn>

                <v-btn id="btnPin" fab x-small @click="pinActive = !pinActive">
                    <v-icon dark> mdi-pin{{ pinActive ? '-off' : '' }} </v-icon>
                </v-btn>
            </div>
        </div>
        <v-btn
            v-if="
                $viewport.width < 450 &&
                    !isGuessButtonClicked &&
                    isMakeGuessButtonClicked
            "
            id="hide-map-button"
            fab
            x-small
            color="red"
            @click="hideMap"
        >
            <v-icon color="white"> mdi-close </v-icon>
        </v-btn>
        <Map
            v-if="this.mode === 'classic'"
            id="map"
            ref="map"
            :bbox="bbox"
            @setSeletedPos="setSeletedPos"
        />
        <MapAreas
            v-if="this.mode !== 'classic'"
            id="map"
            ref="map"
            :area="area"
            :areasGeoJsonUrl="areasGeoJsonUrl"
            :pathKey="pathKey"
            :bbox="bbox"
            :showFlag="this.mode === 'country'"
            @setSeletedPos="setSeletedPos"
        />
        <textarea
            class="container-map_notepad"
            v-show="isNotepadVisible"
            spellcheck="false"
            v-if="!printMapFull"
            ref="refNotepad"
        />
        <button
            v-if="
                !isNextButtonVisible &&
                    !isSummaryButtonVisible &&
                    ($viewport.width > 450 || isMakeGuessButtonClicked)
            "
            id="guess-button"
            :disabled="
                randomLatLng == null ||
                    selectedPos == null ||
                    isGuessButtonClicked ||
                    (!!this.room && !isReady)
            "
            @click="selectLocation"
        >
            {{ $t('Maps.guess') }}
        </button>
        <button
            v-if="isNextButtonVisible"
            id="next-button"
            :disabled="!isNextButtonEnabled"
            :style="{
                backgroundColor: isNextButtonEnabled ? '#F44336' : '#B71C1C',
            }"
            @click="goToNextRound(false)"
        >
            {{ $t('Maps.nextRound') }}
        </button>
        <button
            v-if="isSummaryButtonVisible"
            id="summary-button"
            @click="dialogSummary = true"
        >
            {{ $t('Maps.viewSummary') }}
        </button>

        <button
            v-if="
                $viewport.width < 450 &&
                    !isGuessButtonClicked &&
                    !isMakeGuessButtonClicked &&
                    !isNextButtonVisible
            "
            id="make-guess-button"
            class="primary"
            @click="showMap"
        >
            {{ $t('Maps.makeGuess') }}
        </button>
        <DialogSummary
            :dialog-summary="dialogSummary"
            :summary-texts="summaryTexts"
            :score="score"
            :player-name="playerName"
            :points="points"
            :game="game"
            :multiplayer="!!room"
            :mapDetails="mapDetails"
            :nb-round="nbRound"
            @finishGame="finishGame"
            @playAgain="goToNextRound(true)"
        />
    </div>
</template>

<script>
import firebase from 'firebase/app';
import 'firebase/database';

import DialogSummary from '@/components/DialogSummary';
import DetailsMap from '@/components/game/DetailsMap';
import Map from '@/components/map/Map';
import MapAreas from '@/components/map/MapAreas';
import { GAME_MODE } from '../constants';
import { getSelectedPos } from '../utils';
import { getScore } from '../utils/game/score';
import Leaderboard from "@/components/game/Leaderboard.vue";

export default {
    components: {
        Leaderboard,
        DialogSummary,
        DetailsMap,
        Map,
        MapAreas,
    },
    props: [
        'randomLatLng',
        'randomFeatureProperties',
        'roomName',
        'playerNumber',
        'playerName',
        'isReady',
        'round',
        'score',
        'points',
        'timeLimitation',
        'difficulty',
        'bbox',
        'mode',
        'area',
        'timeAttack',
        'nbRound',
        'countdown',
        'scoreMode',
        'areasGeoJsonUrl',
        'pathKey',
        'mapDetails',
        'leaderboardShown',
        'guessString'
    ],
    data() {
        return {
            summaryTexts: [],
            room: null,
            selectedPos: null,
            distance: null,
            point: null,
            isGuessButtonClicked: false,
            isMakeGuessButtonClicked: false,
            isSelected: false,
            isNextStreetViewReady: false,
            isNextButtonVisible: false,
            isSummaryButtonVisible: false,
            dialogSummary: false,
            activeMap: false,
            size: 2,
            isNotepadVisible: false,
            pinActive: localStorage.getItem('pinActive') === 'true',
            printMapFull: false,
            countdownStarted: false,
            aiResults: Object.create(null), 
            aiMarker: null,
            aiPolyline: null,
            isAILoading: false,
            game: {
                multiplayer: !!this.roomName,
                date: new Date(),
                rounds: [],
            },
            startTime: null,
        };
    },
    computed: {
        isNextButtonEnabled() {
            if (this.playerNumber == 1 || !this.room) {
                return true;
            } else {
                return this.isNextStreetViewReady;            
            }
        },
        aiResult() {
            return this.aiResults[String(this.round)] || null;
        },
    },
    watch: {
      pinActive() {
        localStorage.setItem('pinActive', this.pinActive);
      },
      printMapFull(value) {
        this.$emit('printMapFull', value);
      }
    },
    async mounted() {
        await this.$gmapApiPromiseLazy();
        this.game.timeLimitation = this.timeLimitation;
        this.game.difficulty = this.difficulty;
        this.game.mode = this.mode;
        this.game.timeAttack = this.timeAttack;
        this.game.playerName = this.playerName;
        let size = 0;

        if (this.roomName) {
            this.room = firebase.database().ref(this.roomName);

            this.room.on('value', (snapshot) => {
                if (snapshot.hasChild('active')) {
                    size = snapshot.child('size').val();
                    if (size === 1) {
                        this.room.onDisconnect().remove();
                    } else {
                        this.room.onDisconnect().update({ size: size - 1 });
                    }
                    if (
                        // If Time Attack and 1st true guess finish round
                        (this.timeAttack &&
                            this.countdown === 0 &&
                            snapshot.child('guess').numChildren() >= 1 &&
                            snapshot
                                .child('guess')
                                .forEach(
                                    (guess) =>
                                        guess.child('area').val() === this.area
                                )) ||
                        // Allow players to move on to the next round when every players guess locations
                        snapshot.child('guess').numChildren() === size
                    ) {
                        this.game.timeLimitation = this.timeLimitation;
                        this.isNextStreetViewReady = false;

                        this.$emit('showResult');

                        const aiSnap = snapshot.child(`ai/round${this.round}`);
                        if (aiSnap.exists()) {
                            this.applyAIResult(aiSnap.val());
                        }
                        // Put markers and draw polylines on the map
                        let i = 0;
                        let players = {};
                        snapshot.child('guess').forEach((childSnapshot) => {
                            let posGuess;
                            if (this.mode === GAME_MODE.CLASSIC) {
                                const lat = childSnapshot
                                    .child('latitude')
                                    .val();
                                const lng = childSnapshot
                                    .child('longitude')
                                    .val();
                                posGuess = new google.maps.LatLng({
                                    lat: lat,
                                    lng: lng,
                                });
                            } else {
                                posGuess = childSnapshot.child('area').val();
                            }

                            const playerName = snapshot
                                .child('playerName')
                                .child(childSnapshot.key)
                                .val();
                            const roundValues = snapshot
                                .child('round' + this.round + '/' + childSnapshot.key)
                                .exportVal();

                            const { points, distance } = roundValues;

                            players[playerName] = {
                                ...roundValues,
                                guess: posGuess,
                            };
                            this.$refs.map.drawPolyline(
                                posGuess,
                                i,
                                this.randomLatLng
                            );
                            this.$refs.map.putMarker(
                                posGuess,
                                false,
                                playerName && playerName.length > 0
                                    ? playerName[0].toUpperCase()
                                    : ''
                            );
                            this.$refs.map.setInfoWindow(
                                playerName,
                                distance,
                                points,
                                false
                            );
                            i++;
                        });
                        this.$refs.map.fitBounds();
                        this.game.rounds.push({
                            position: {
                                ...this.randomLatLng.toJSON(),
                                area: this.area,
                            },
                            players,
                        });
                        this.$refs.map.putMarker(this.randomLatLng, true);

                        this.printMapFull = true;
                        // Remove guess node every time the round is done
                        this.room.child('guess').remove();

                        if (this.round >= this.nbRound) {
                            // Show summary button
                            snapshot
                                .child('finalPoints')
                                .forEach((childSnapshot) => {
                                    const playerName = snapshot
                                        .child('playerName')
                                        .child(childSnapshot.key)
                                        .val();
                                    const finalScore = snapshot
                                        .child('finalScore')
                                        .child(childSnapshot.key)
                                        .val();
                                    const finalPoints = childSnapshot.val();
                                    this.summaryTexts.push({
                                        playerName: playerName,
                                        finalScore: finalScore,
                                        finalPoints: finalPoints,
                                    });
                                });

                            this.summaryTexts.sort(
                                (a, b) =>
                                    parseInt(b.finalPoints) -
                                    parseInt(a.finalPoints)
                            );

                            this.isSummaryButtonVisible = true;
                        } else {
                            // Show next button
                            this.isNextButtonVisible = true;
                        }
                    }

                    // Allow other players to move on to the next round when the next street view is set
                    if (
                        snapshot.child('streetView').numChildren() ==
                        this.round + 1
                    ) {
                        this.isNextStreetViewReady = true;
                    }

                    if (
                        !this.countdownStarted &&
                        !this.printMapFull &&
                        this.countdown > 0 &&
                        snapshot.child('guess').numChildren() >= 1
                    ) {
                        this.$parent.initTimer(this.countdown, true);

                        this.countdownStarted = true;
                    }
                }
            });
        }
    },
    methods: {
        setSeletedPos(pos) {
            this.selectedPos = pos;
        },
        showMap() {
            this.isMakeGuessButtonClicked = true;
        },
        hideMap() {
            this.isMakeGuessButtonClicked = false;
        },
        showNotepad() {
            this.isNotepadVisible = !this.isNotepadVisible;
            if (this.isNotepadVisible) {
                setTimeout(() => {
                    this.$refs.refNotepad.focus();
                });
            }
        },
        applyAIScoreBonus() {
            if (!this.aiResult) return;
            if (this.distance == null || this.aiResult.distance == null) return;

            let multiplier = 1.0;

            if (this.distance < this.aiResult.distance) {
                multiplier = AI_SCORE_MULTIPLIER.win;
            } else if (this.distance > this.aiResult.distance) {
                multiplier = AI_SCORE_MULTIPLIER.lose;
            } else {
                multiplier = AI_SCORE_MULTIPLIER.draw;
            }

            this.point = Math.round(this.point * multiplier);
        },
        applyAIResult(ai) {
            if (!ai) return;
            if (!this.$refs.map || !this.$refs.map.map) {
                this.$nextTick(() => this.applyAIResult(ai));
                return;
            }
            
            const roundKey = String(this.round);
            if (this.aiResults[roundKey]) return;

            const answerPos = new google.maps.LatLng(
                this.randomLatLng.lat(),
                this.randomLatLng.lng()
            );
            const aiPos = new google.maps.LatLng(
                ai.latitude,
                ai.longitude
            );

            let aiDistance = null;
            if (google.maps.geometry?.spherical) {
                aiDistance =
                    google.maps.geometry.spherical.computeDistanceBetween(
                        aiPos,
                        answerPos
                    );
            }
 
            this.$set(this.aiResults, roundKey, {
                ...ai,
                distance: aiDistance,
            });

            if (this.aiPolyline) {
                this.aiPolyline.setMap(null);
            }

            this.aiPolyline = new google.maps.Polyline({
                path: [aiPos, answerPos],
                geodesic: true,
                strokeOpacity: 0,
                icons: [
                    {
                        icon: {
                            path: "M 0,-1 0,1",
                            strokeOpacity: 1,
                            scale: 4,
                            strokeColor: "#2196F3", // AI用：青
                        },
                        offset: "0",
                        repeat: "10px",
                    },
                ],
                map: this.$refs.map.map,
            });

            if (this.aiMarker) {
                this.aiMarker.setMap(null);
            }
            const aiIcon = {
                url: `data:image/svg+xml;utf8,
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
                  <path d="M18 0C11 0 5 6 5 13c0 9 13 23 13 23s13-14 13-23C31 6 25 0 18 0z"
                        fill="%232196F3"/>
                  <circle cx="18" cy="14" r="7" fill="white"/>
                  <text x="18" y="18"
                        text-anchor="middle"
                        font-size="8"
                        font-weight="bold"
                        fill="%232196F3"
                        font-family="Arial">
                    AI
                  </text>
                </svg>`,
                scaledSize: new google.maps.Size(36, 36),
                anchor: new google.maps.Point(18, 36),
            };
            this.aiMarker = new google.maps.Marker({
                position: aiPos,
                map: this.$refs.map.map,
                icon: aiIcon,
                title: 'AI',
            });
        },    
        async selectLocation() {
            // ① まず人間の距離・スコアを計算
            this.calculateDistance();

            if (this.room) {
                // ② すでに AI がいれば読む
                const snap = await this.room.child(`ai/round${this.round}`).get();
            
                if (snap.exists()) {
                    this.applyAIResult(snap.val());
                } else if (this.playerNumber === 1) {
                    const aiData = await this.callAIGuess();

                    if (aiData) {
                        await this.room.child(`ai/round${this.round}`).set(aiData);
                        this.applyAIResult(aiData);
                    }
                }

                this.applyAIScoreBonus();

                // ⑤ 人間の結果を保存（全員）
                this.room
                    .child(`round${this.round}/player${this.playerNumber}`)
                    .set({
                        ...getSelectedPos(this.selectedPos, this.mode),
                        distance: this.distance,
                        points: this.point,
                        timePassed: this.startTime
                            ? new Date() - this.startTime
                            : 0,
                    });

                this.room
                    .child(`guess/player${this.playerNumber}`)
                    .set(getSelectedPos(this.selectedPos, this.mode));

            } else {
                const aiData = await this.callAIGuess();
                if (aiData) {
                    this.applyAIResult(aiData);
                }

                this.applyAIScoreBonus();
                this.$refs.map.putMarker(this.randomLatLng, true);
                this.$refs.map.drawPolyline(this.selectedPos, 1, this.randomLatLng);
                this.$refs.map.setInfoWindow(
                    null,
                    this.distance,
                    this.point,
                    false
                );
                this.printMapFull = true;
                this.$refs.map.fitBounds();
                this.isNextButtonVisible = this.round < this.nbRound;
                this.isSummaryButtonVisible = this.round >= this.nbRound;
                this.$emit('showResult');
            }

            this.$refs.map.removeListener();
            this.isGuessButtonClicked = true;
            this.isSelected = true;
            this.isNextStreetViewReady = false;
        },
        async callAIGuess() {
            this.isAILoading = true;
            try {
                const response = await fetch("/.netlify/functions/gemini", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        lat: this.randomLatLng.lat(), 
                        lng: this.randomLatLng.lng(),
                        lang: this.$i18n.locale
                    }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    /* eslint-disable-next-line no-console */
                    console.error("Server Error Details:", errorText);
                    return null;
                }
                const data = await response.json();
                /* eslint-disable-next-line no-console */
                console.log("AI Response Data:", data); // ← これをコンソールで確認してください

                if (!data || data.latitude === undefined) {
                    /* eslint-disable-next-line no-console */
                    console.error("AI Data is empty or invalid structure");
                    return null;
                }
            
                return data;
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error("AI Guess failed", e);
            } finally {
                this.isAILoading = false;
            }
        },
        selectRandomLocation(randomLatLng) {
            if (this.selectedPos === null) {
                // set a random location if the player didn't select in time
                this.selectedPos = randomLatLng;
                this.$refs.map.removeMarkers();
                this.$refs.map.putMarker(this.selectedPos);
            }
            this.selectLocation();
        },
        resetLocation() {
            this.$emit('resetLocation');
        },
        calculateDistance() {
            const timePassed = new Date() - this.startTime;
            if (
                [GAME_MODE.COUNTRY, GAME_MODE.CUSTOM_AREA].includes(this.mode)
            ) {
                this.point = +(this.area === this.selectedPos);
                this.distance = null;
            } else {
                this.distance = Math.floor(
                    google.maps.geometry.spherical.computeDistanceBetween(
                        this.randomLatLng,
                        this.selectedPos
                    )
                );

                this.point = getScore(
                    this.distance,
                    this.difficulty,
                    timePassed,
                    this.scoreMode
                );
            }

            this.$emit('calculateDistance', this.distance, this.point);
        },
        startNextRound() {
            this.$refs.map.startNextRound();
            this.startTime = new Date();
        },
        goToNextRound(isPlayAgain = false) {
            if (this.aiMarker) {
            this.aiMarker.setMap(null);
            this.aiMarker = null;
            }
            
            if (this.aiPolyline) {
                this.aiPolyline.setMap(null);
                this.aiPolyline = null;
            }
            
            if (isPlayAgain) {
                this.dialogSummary = false;
                this.isSummaryButtonVisible = false;
                this.$delete(this.aiResults, this.round);
                if (this.aiMarker) {
                    this.aiMarker.setMap(null);
                    this.aiMarker = null;
                }
            }

            // Reset
            this.selectedPos = null;
            this.isGuessButtonClicked = false;
            this.isSelected = false;
            this.isNextButtonVisible = false;
            this.countdownStarted = false;
            this.isNotepadVisible = false;

            if (this.$viewport.width < 450) {
                // Hide the map if the player is on mobile
                this.hideMap();
            }

            this.printMapFull = false;
            this.$refs.map.removeMarkers();
            this.$refs.map.removePolylines();
            this.$refs.map.centerOnBbox();

            // Replace the streetview with the next one
            this.$emit('goToNextRound', isPlayAgain);
        },
        finishGame() {
            this.dialogSummary = false;
            if (this.room)
                this.room
                    .child('isGameDone/player' + this.playerNumber)
                    .set(true);
            this.$emit('finishGame');
        },
    }
};
</script>

<style scoped lang="scss">
.alert-container {
    position: absolute;
    right: 0;
    .v-alert {
        z-index: 2;
    }
}

/* AI 推測結果表示 */
.ai-result-box {
  background: rgba(0, 0, 0, 0.75);
  color: #ffffff;
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  font-size: 14px;
}

.ai-result-box h3 {
  margin: 0 0 4px 0;
  font-size: 15px;
  color: #ffd54f;
}

.ai-result-box p {
  margin: 2px 0;
}

.ai-result-box .ai-reason {
  font-size: 13px;
  opacity: 0.9;
}

#container-map {
    display: flex;
    flex-direction: column;
    position: absolute;
    bottom: 5px;
    left: 10px;
    z-index: 3;
    opacity: 0.7;
    width: var(--width);
    height: var(--height);
    --aspect-ratio: 1.25;
    --inactive-width: 16vw;
    --active-width: 30vw;
    --active-height: calc(var(--active-width) / var(--aspect-ratio));
    --inactive-height: calc(var(--inactive-width) / var(--aspect-ratio));
    --height: var(--inactive-height);
    --width: var(--inactive-width);
    max-width: 100%;
    max-height: calc(100% - 150px);
    transition: 0.3s;
    #map {
        width: 100%;
        height: 100%;
    }

    &.container-map--size-1 {
        --active-width: 16vw;
    }
    &.container-map--size-3 {
        --active-width: 45vw;
    }
    &.container-map--size-4 {
        --active-width: 65vw;
    }
    &.container-map--active {
        opacity: 1;
        --width: var(--active-width);
        --height: var(--active-height);
        .container-map_controls {
            display: flex;
        }
    }
    &.container-map--full {
        transition: none;
        opacity: 1;
        --active-width: 85vw;
        --inactive-width: 85vw;
        position: relative;
        margin: auto;
        .container-map_controls {
            display: none;
        }
        .container-map_details {
            display: block;
            position: relative;
        }
    }

    .container-map_details {
        display: none;
    }
    .container-map_controls {
        .container-map_btns {
            background-color: rgba(33, 33, 33);
            padding: 0.2rem;
            border-top-left-radius: 5%;
            border-top-right-radius: 5%;
        }
        button {
            width: 1.5rem;
            height: 1.5rem;
            margin: 0 0.5rem;
        }
        display: flex;
        flex-direction: row-reverse;
    }

    .container-map_notepad {
        position: absolute;
        background-color: var(--v-notepad-base);
        resize: none;
        left: var(--width);
        margin-left: 10px;
        transition: 0.3s;
        width: 300px;
        height: calc(100% - 74px);
        top: 30px;
        border-radius: 3px;
        outline: none;
        padding: 5px;
        box-shadow: 0px 2px 8px 0px rgba(99, 99, 99, 0.2);
    }

    .theme--dark & .container-map_notepad {
        color: #fff;
    }
    .theme--light & .container-map_notepad {
        color: #000;
    }
}

#make-guess-button,
#guess-button,
#next-button,
#summary-button,
#reset-button,
#play-again-button {
    border: none;
    border-bottom-right-radius: 5px;
    border-bottom-left-radius: 5px;
    opacity: 0.8;
    color: white;
    font-size: 16px;
    text-decoration: none;
    text-align: center;
    padding: 10px 0;
    z-index: 999;
}


#reset-button {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    width: 25%;
    background-color: #ff5e5e;
}

#next-button,
#summary-button:not(.w-50) {
    width: 100%;
}
button.w-50 {
    width: 50%;
}
#make-guess-button,
#guess-button {
    background-color: #212121;
}

#guess-button:hover,
#reset-button {
    opacity: 1;
}

#play-again-button {
    background-color: #43b581;
}

#next-button,
#summary-button {
    background-color: #f44336;
}

@media (max-width: 750px) {
    #container-map {
        --inactive-width: 25vw;

        &.container-map--size-1 {
            --active-width: 25vw;
        }
    }
}

@media (max-width: 450px) {
    #container-map {
        width: 100%;
        opacity: 1;
        height: auto;
        left: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        .container-map_controls {
            display: none;
        }
        .container-map_notepad {
            display: none;
        }
        #map {
            display: none;
        }
        &.container-map--active #map {
            display: block;
        }

        &.container-map--active .container-map_controls {
            display: none;
        }
        &.container-map--active {
            height: 40vh;
        }
        &.container-map--full {
            position: absolute;
            --width: 100%;
            height: calc(100% - 64px);
            bottom: 0;
            margin: 0;
            max-height: 100%;
        }
        .container-map_controls_guess {
            z-index: 999;
        }
    }

    #make-guess-button,
    #next-button,
    #reset-button,
    #guess-button,
    #summary-button {
        border-radius: 0;
        opacity: 1;
        bottom: 0;
        width: 100%;
    }


    #hide-map-button {
        position: absolute;
        top: 0;
        right: 0;
        z-index: 4;
    }
}
</style>
