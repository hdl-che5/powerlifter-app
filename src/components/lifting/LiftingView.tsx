// vim: set ts=2 sts=2 sw=2 et:
//
// This file is part of OpenLifter, simple Powerlifting meet software.
// Copyright (C) 2019 The OpenPowerlifting Project.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation, either version 3 of the
// License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

// The parent component of the Lifting page, contained by the LiftingContainer.
//
// The LiftingTable, LiftingFooter, etc. all share calculated state.
// This class performs the state calculations and communicates that to its
// sub-components via props.

import React from "react";
import { connect } from "react-redux";
import LeftCard from "./LeftCard";
import LiftingFooter from "./LiftingFooter";
import LiftingHeader from "./LiftingHeader";
import LiftingTable from "./LiftingTable";
import WeighinsView from "../weighins/WeighinsView";
import RefereeDashboard from "./RefereeDashboard";

import styles from "./LiftingView.module.scss";

import { getLiftingOrder } from "../../logic/liftingOrder";
import { liftToAttemptFieldName } from "../../logic/entry";

import { Entry, Flight, Language, Lift } from "../../types/dataTypes";
import { GlobalState, MeetState, LiftingState } from "../../types/stateTypes";
import { emitSyncReduxState, emitStateUpdate, emitUpdateCurrentLift, getSocket } from "../../socket/socketClient";
import { markLift } from "../../actions/liftingActions";
import { Dispatch } from "redux";

interface StateProps {
  meet: MeetState;
  lifting: LiftingState;
  flightsOnPlatform: Array<Flight>;
  entriesInFlight: Array<Entry>;
  language: Language;
  fullState: GlobalState;
}

interface DispatchProps {
  markLift: (entryId: number, lift: Lift, attempt: number, success: boolean) => void;
}

type Props = StateProps & DispatchProps;

interface InternalState {
  // If true, the LiftingTable is replaced with the Weighins page.
  // This lets the score table change arbitrary rack height and attempt information
  // without removing the current lifter or bar load displays.
  replaceTableWithWeighins: boolean;
}

class LiftingView extends React.Component<Props, InternalState> {
  constructor(props: Props) {
    super(props);
    this.toggleReplaceTableWithWeighins = this.toggleReplaceTableWithWeighins.bind(this);
    this.state = {
      replaceTableWithWeighins: false,
    };
  }

  toggleReplaceTableWithWeighins = (): void => {
    this.setState({
      replaceTableWithWeighins: !this.state.replaceTableWithWeighins,
    });
  };

  componentDidMount() {
    // When all 3 judges have voted, auto-apply the result to Redux
    // so the table updates without the referee clicking Good/No Lift manually.
    const socket = getSocket();
    socket.on("final_result", ({ result }: { result: string; votes: Record<number, boolean | null> }) => {
      const now = getLiftingOrder(this.props.entriesInFlight, this.props.lifting);
      if (now.currentEntryId == null) return;
      const success = result === "good";
      this.props.markLift(now.currentEntryId, this.props.lifting.lift as Lift, now.attemptOneIndexed, success);
    });

    this.emitCurrentLifterState();
  }

  componentWillUnmount() {
    const socket = getSocket();
    socket.off("final_result");
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.fullState !== this.props.fullState) {
      emitSyncReduxState(this.props.fullState);
    }

    const entriesChanged = prevProps.entriesInFlight !== this.props.entriesInFlight;
    const liftingChanged = prevProps.lifting !== this.props.lifting;
    if (entriesChanged || liftingChanged) {
      this.emitCurrentLifterState();
    }
  }

  emitCurrentLifterState = (): void => {
    const now = getLiftingOrder(this.props.entriesInFlight, this.props.lifting);
    if (now.currentEntryId == null) {
      emitStateUpdate({
        currentAthlete: null,
        currentLift: this.props.lifting.lift,
        currentAttempt: now.attemptOneIndexed,
        requestedWeightKg: 0,
      });
      return;
    }

    const entry = this.props.entriesInFlight.find((x) => x.id === now.currentEntryId);
    const weightKg = entry ? entry[liftToAttemptFieldName(this.props.lifting.lift)][now.attemptOneIndexed - 1] : 0;
    emitUpdateCurrentLift({
      athleteId: entry?.id,
      athleteName: entry?.name,
      liftType: this.props.lifting.lift,
      attemptNumber: now.attemptOneIndexed,
      weightKg,
    });
  };

  render() {
    const now = getLiftingOrder(this.props.entriesInFlight, this.props.lifting);
    let rightElement = null;
    if (this.state.replaceTableWithWeighins === false) {
      rightElement = (
        <LiftingTable
          attemptOneIndexed={now.attemptOneIndexed}
          orderedEntries={now.orderedEntries}
          currentEntryId={now.currentEntryId}
        />
      );
    } else {
      rightElement = (
        <WeighinsView day={this.props.lifting.day} platform={this.props.lifting.platform} inLiftingPage={true} />
      );
    }

    return (
      <div>
        {/* Column width / zoom instructions card — commented out, not needed for live competition
        <Card style={{ margin: "12px 20px" }}>
          <Card.Body>
            <div style={{ width: "160px" }}>
              <ColumnWidth
                label={getString("lifting.division-column-width-label", this.props.language)}
                fieldName="columnDivisionWidthPx"
              />
            </div>
            <h3>
              <FormattedMessage
                id="lifting.garish-instructions"
                defaultMessage="To fit to the screen, zoom the browser in or out and then press Toggle Fullscreen."
              />
            </h3>
          </Card.Body>
        </Card>
        */}

        <div id="liftingView" className={styles.liftingView}>
          {/* Referee Dashboard is INSIDE liftingView so it goes fullscreen with everything else */}
          <div style={{ margin: "0 0 8px 0" }}>
            <RefereeDashboard
              mode={(this.props.meet.competitionMode as "Standard" | "Handicap") || "Standard"}
              currentAthlete={
                now.currentEntryId != null
                  ? (() => {
                      const e = this.props.entriesInFlight.find((x) => x.id === now.currentEntryId);
                      return e
                        ? {
                            name: e.name,
                            bodyweightKg: e.bodyweightKg,
                            category: e.sex,
                            lot: e.lot,
                            team: e.team,
                            athletePhotoUrl: e.athletePhotoUrl,
                            clubLogoUrl: e.clubLogoUrl,
                          }
                        : null;
                    })()
                  : null
              }
              requestedWeightKg={
                now.currentEntryId != null
                  ? (() => {
                      const e = this.props.entriesInFlight.find((x) => x.id === now.currentEntryId);
                      if (!e) return 0;
                      const lift = this.props.lifting.lift;
                      const arr = lift === "S" ? e.squatKg : lift === "B" ? e.benchKg : e.deadliftKg;
                      return arr[now.attemptOneIndexed - 1] || 0;
                    })()
                  : 0
              }
              currentLift={this.props.lifting.lift}
              currentAttempt={now.attemptOneIndexed}
            />
          </div>

          <LiftingHeader
            attemptOneIndexed={now.attemptOneIndexed}
            orderedEntries={now.orderedEntries}
            currentEntryId={now.currentEntryId}
          />

          <div className={styles.middleParentContainer}>
            <div className={styles.leftCardContainer}>
              <LeftCard
                attemptOneIndexed={now.attemptOneIndexed}
                orderedEntries={now.orderedEntries}
                currentEntryId={now.currentEntryId}
                nextEntryId={now.nextEntryId}
                nextAttemptOneIndexed={now.nextAttemptOneIndexed}
              />
            </div>

            <div className={styles.rightCardContainer}>{rightElement}</div>
          </div>

          <LiftingFooter
            attemptOneIndexed={now.attemptOneIndexed}
            orderedEntries={now.orderedEntries}
            currentEntryId={now.currentEntryId}
            flightsOnPlatform={this.props.flightsOnPlatform}
            toggleReplaceTableWithWeighins={this.toggleReplaceTableWithWeighins}
          />
        </div>
      </div>
    );
  }
}

const mapStateToProps = (state: GlobalState): StateProps => {
  const day = state.lifting.day;
  const platform = state.lifting.platform;
  const flight = state.lifting.flight;

  const entriesOnPlatform = state.registration.entries.filter(
    (entry) => entry.day === day && entry.platform === platform,
  );

  // Determine available flights from the entries themselves.
  const flights: Array<Flight> = [];
  for (let i = 0; i < entriesOnPlatform.length; i++) {
    const entry = entriesOnPlatform[i];
    if (flights.indexOf(entry.flight) === -1) {
      flights.push(entry.flight);
    }
  }
  flights.sort();

  // Only receive entries that are in the currently-lifting group.
  const entriesInFlight = entriesOnPlatform.filter((entry) => entry.flight === flight);

  return {
    meet: state.meet,
    lifting: state.lifting,
    flightsOnPlatform: flights,
    entriesInFlight: entriesInFlight,
    language: state.language,
    fullState: state,
  };
};

const mapDispatchToProps = (dispatch: Dispatch): DispatchProps => ({
  markLift: (entryId, lift, attempt, success) => dispatch(markLift(entryId, lift, attempt, success) as any),
});

export default connect(mapStateToProps, mapDispatchToProps)(LiftingView);
