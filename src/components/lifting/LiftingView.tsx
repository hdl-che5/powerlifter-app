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
import { emitSyncReduxState, emitUpdateCurrentLift, getSocket } from "../../socket/socketClient";
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

interface LastEmittedLiftState {
  athleteId?: number;
  athleteName?: string;
  liftType?: string;
  attemptNumber?: number;
  weightKg?: number;
  currentAthlete?: {
    name?: string;
    bodyweightKg?: number;
    category?: string;
    lot?: number;
    team?: string;
    athletePhotoUrl?: string;
    clubLogoUrl?: string;
  };
  nextAthlete?: {
    name?: string;
    bodyweightKg?: number;
    category?: string;
    lot?: number;
    team?: string;
    athletePhotoUrl?: string;
    clubLogoUrl?: string;
  };
}

class LiftingView extends React.Component<Props, InternalState> {
  private lastEmittedLiftState: LastEmittedLiftState | null = null;

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
      if (this.lastEmittedLiftState) {
        emitUpdateCurrentLift({
          athleteId: this.lastEmittedLiftState.athleteId,
          athleteName: this.lastEmittedLiftState.athleteName,
          liftType: this.lastEmittedLiftState.liftType ?? this.props.lifting.lift,
          attemptNumber: this.lastEmittedLiftState.attemptNumber ?? now.attemptOneIndexed,
          weightKg: this.lastEmittedLiftState.weightKg ?? 0,
          currentAthlete: this.lastEmittedLiftState.currentAthlete,
          nextAthlete: this.lastEmittedLiftState.nextAthlete,
        });
      } else {
        emitUpdateCurrentLift({
          liftType: this.props.lifting.lift,
          attemptNumber: now.attemptOneIndexed,
          weightKg: 0,
        });
      }
      return;
    }

    const entry = this.props.entriesInFlight.find((x) => x.id === now.currentEntryId);
    const nextEntry = now.nextEntryId ? this.props.entriesInFlight.find((x) => x.id === now.nextEntryId) : undefined;
    const weightKg = entry ? entry[liftToAttemptFieldName(this.props.lifting.lift)][now.attemptOneIndexed - 1] : 0;
    const payload: LastEmittedLiftState = {
      athleteId: entry?.id,
      athleteName: entry?.name,
      liftType: this.props.lifting.lift,
      attemptNumber: now.attemptOneIndexed,
      weightKg,
      currentAthlete:
        entry && entry.id != null
          ? {
              id: entry.id,
              name: entry.name,
              bodyweightKg: entry.bodyweightKg,
              category: entry.sex,
              lot: entry.lot,
              team: entry.team,
              athletePhotoUrl: entry.athletePhotoUrl,
              clubLogoUrl: entry.clubLogoUrl,
            }
          : undefined,
      nextAthlete:
        nextEntry && nextEntry.id != null
          ? {
              id: nextEntry.id,
              name: nextEntry.name,
              bodyweightKg: nextEntry.bodyweightKg,
              category: nextEntry.sex,
              lot: nextEntry.lot,
              team: nextEntry.team,
              athletePhotoUrl: nextEntry.athletePhotoUrl,
              clubLogoUrl: nextEntry.clubLogoUrl,
            }
          : undefined,
    };
    this.lastEmittedLiftState = payload;
    emitUpdateCurrentLift(payload);
  };

  render() {
    const now = getLiftingOrder(this.props.entriesInFlight, this.props.lifting);
    const displayCurrentAthlete =
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
        : this.lastEmittedLiftState?.currentAthlete ?? null;

    const displayRequestedWeightKg =
      now.currentEntryId != null
        ? (() => {
            const e = this.props.entriesInFlight.find((x) => x.id === now.currentEntryId);
            if (!e) return 0;
            const lift = this.props.lifting.lift;
            const arr = lift === "S" ? e.squatKg : lift === "B" ? e.benchKg : e.deadliftKg;
            return arr[now.attemptOneIndexed - 1] || 0;
          })()
        : this.lastEmittedLiftState?.weightKg ?? 0;

    const displayCurrentLift = this.lastEmittedLiftState?.liftType ?? this.props.lifting.lift;
    const displayCurrentAttempt = this.lastEmittedLiftState?.attemptNumber ?? now.attemptOneIndexed;

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
              currentAthlete={displayCurrentAthlete}
              requestedWeightKg={displayRequestedWeightKg}
              currentLift={displayCurrentLift}
              currentAttempt={displayCurrentAttempt}
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
