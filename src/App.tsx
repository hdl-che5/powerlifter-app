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

import React from "react";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";

import OpenLifterIntlProvider from "./components/translations/OpenLifterIntlProvider";

import RootContainer from "./containers/RootContainer";
import MeetSetupContainer from "./containers/MeetSetupContainer";
import RegistrationContainer from "./containers/RegistrationContainer";
import WeighinsContainer from "./containers/WeighinsContainer";
import LiftingContainer from "./containers/LiftingContainer";
import FlightOrderContainer from "./containers/FlightOrderContainer";
import ResultsContainer from "./containers/ResultsContainer";
import DebugContainer from "./containers/DebugContainer";
import AboutContainer from "./containers/AboutContainer";
import Navigation from "./components/Navigation";

// ── New screens ──────────────────────────────────────────────────────────────
import JudgeView from "./components/judge/JudgeView";
import TVScreen from "./components/tv/TVScreen";
import CompetitionList from "./components/home/CompetitionList";
import ChronoScreen from "./components/chrono/ChronoScreen";
import MarshallScreen from "./components/marshall/MarshallScreen";

import configureStore from "./store";

import { getDefaultLanguage } from "./logic/strings";

// Screens that should render without the Navigation bar (fullscreen)
const FULLSCREEN_PATHS = ["/judge", "/tv", "/audience", "/competitions", "/chrono", "/marshall"];

const AppRoutes: React.FC = () => {
  const location = useLocation();
  const isFullscreen = FULLSCREEN_PATHS.some((p) => location.pathname.startsWith(p));

  return (
    <div>
      {!isFullscreen && <Navigation />}
      <Routes>
        {/* ── Original OpenLifter routes ── */}
        <Route path="/" element={<RootContainer />} />
        <Route path="/meet-setup" element={<MeetSetupContainer />} />
        <Route path="/registration" element={<RegistrationContainer />} />
        <Route path="/weigh-ins" element={<WeighinsContainer />} />
        <Route path="/flight-order" element={<FlightOrderContainer />} />
        <Route path="/lifting" element={<LiftingContainer />} />
        <Route path="/results" element={<ResultsContainer />} />
        <Route path="/debug" element={<DebugContainer />} />
        <Route path="/about" element={<AboutContainer />} />

        {/* ── New real-time screens ── */}
        <Route path="/judge/:id" element={<JudgeView />} />
        <Route path="/tv" element={<TVScreen />} />
        <Route path="/audience" element={<TVScreen />} />
        <Route path="/competitions" element={<CompetitionList />} />
        <Route path="/chrono" element={<ChronoScreen />} />
        <Route path="/marshall" element={<MarshallScreen />} />
      </Routes>
    </div>
  );
};

class App extends React.Component {
  render() {
    const { store, persistor } = configureStore({ language: getDefaultLanguage() });

    return (
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <OpenLifterIntlProvider>
            <BrowserRouter basename={process.env.REACT_APP_ROUTER_BASENAME}>
              <AppRoutes />
            </BrowserRouter>
          </OpenLifterIntlProvider>
        </PersistGate>
      </Provider>
    );
  }
}

export default App;
