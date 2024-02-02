import _ from "underscore";
import { t } from "ttag";
import { createAction, createThunkAction } from "metabase/lib/redux";

import Questions from "metabase/entities/questions";

import {
  getPositionForNewDashCard,
  DEFAULT_CARD_SIZE,
  GRID_WIDTH,
} from "metabase/lib/dashboard_grid";
import { createCard } from "metabase/lib/card";

import { getVisualizationRaw } from "metabase/visualizations";
import { autoWireParametersToNewCard } from "metabase/dashboard/actions/auto-wire-parameters/actions";

import { trackCardCreated, trackQuestionReplaced } from "../analytics";
import { createPlaceholderDashCard } from "../dashcard-utils";
import { layoutOptions } from "../sections";
import { getDashCardById, getDashboardId } from "../selectors";
import { isVirtualDashCard } from "../utils";

import {
  ADD_CARD_TO_DASH,
  REMOVE_CARD_FROM_DASH,
  UNDO_REMOVE_CARD_FROM_DASH,
  setDashCardAttributes,
} from "./core";
import { cancelFetchCardData, fetchCardData } from "./data-fetching";
import { loadMetadataForDashboard } from "./metadata";
import { getExistingDashCards } from "./utils";

export const MARK_NEW_CARD_SEEN = "metabase/dashboard/MARK_NEW_CARD_SEEN";
export const markNewCardSeen = createAction(MARK_NEW_CARD_SEEN);

let tempId = -1;

export function generateTemporaryDashcardId() {
  return tempId--;
}

export const addCardToDashboard =
  ({ dashId, cardId, tabId }) =>
  async (dispatch, getState) => {
    await dispatch(Questions.actions.fetch({ id: cardId }));
    const card = Questions.selectors
      .getObject(getState(), { entityId: cardId })
      .card();
    const visualization = getVisualizationRaw([{ card }]);
    const createdCardSize = visualization.defaultSize || DEFAULT_CARD_SIZE;

    const dashboardState = getState().dashboard;

    const dashcardId = generateTemporaryDashcardId();
    const dashcard = {
      id: dashcardId,
      dashboard_id: dashId,
      dashboard_tab_id: tabId ?? null,
      card_id: card.id,
      card: card,
      series: [],
      ...getPositionForNewDashCard(
        getExistingDashCards(
          dashboardState.dashboards,
          dashboardState.dashcards,
          dashId,
          tabId,
        ),
        createdCardSize.width,
        createdCardSize.height,
      ),
      parameter_mappings: [],
      visualization_settings: {},
    };
    dispatch(createAction(ADD_CARD_TO_DASH)(dashcard));
    dispatch(fetchCardData(card, dashcard, { reload: true, clearCache: true }));

    await dispatch(loadMetadataForDashboard([dashcard]));

    dispatch(
      autoWireParametersToNewCard({
        dashboard_id: dashId,
        dashcard_id: dashcardId,
      }),
    );
  };

export const replaceCard =
  ({ dashcardId, nextCardId }) =>
  async (dispatch, getState) => {
    const dashboardId = getDashboardId(getState());

    let dashcard = getDashCardById(getState(), dashcardId);
    // if (isVirtualDashCard(dashcard)) {
    //   return;
    // }

    await dispatch(Questions.actions.fetch({ id: nextCardId }));
    const card = Questions.selectors
      .getObject(getState(), { entityId: nextCardId })
      .card();

    await dispatch(
      setDashCardAttributes({
        id: dashcardId,
        attributes: {
          card,
          card_id: card.id,
          series: [],
          parameter_mappings: [],
          visualization_settings: {},
        },
      }),
    );

    dashcard = getDashCardById(getState(), dashcardId);

    dispatch(fetchCardData(card, dashcard, { reload: true, clearCache: true }));
    await dispatch(loadMetadataForDashboard([dashcard]));
    dispatch(autoWireParametersToNewCard({ dashcard_id: dashcardId }));

    trackQuestionReplaced(dashboardId);
  };

export const removeCardFromDashboard = createThunkAction(
  REMOVE_CARD_FROM_DASH,
  ({ dashcardId, cardId }) =>
    (dispatch, _getState) => {
      dispatch(cancelFetchCardData(cardId, dashcardId));
      return { dashcardId };
    },
);

export const undoRemoveCardFromDashboard = createThunkAction(
  UNDO_REMOVE_CARD_FROM_DASH,
  ({ dashcardId }) =>
    (dispatch, getState) => {
      const dashcard = getDashCardById(getState(), dashcardId);
      const card = dashcard.card;

      if (!isVirtualDashCard(dashcard)) {
        dispatch(fetchCardData(card, dashcard));
      }

      return { dashcardId };
    },
);

export const addDashCardToDashboard = function ({
  dashId,
  dashcardOverrides,
  tabId,
}) {
  return function (dispatch, getState) {
    const visualization = getVisualizationRaw([dashcardOverrides]);
    const createdCardSize = visualization.defaultSize || DEFAULT_CARD_SIZE;

    const dashboardState = getState().dashboard;

    const dashcard = {
      id: generateTemporaryDashcardId(),
      card_id: null,
      card: null,
      dashboard_id: dashId,
      dashboard_tab_id: tabId ?? null,
      series: [],
      ...getPositionForNewDashCard(
        getExistingDashCards(
          dashboardState.dashboards,
          dashboardState.dashcards,
          dashId,
          tabId,
        ),
        createdCardSize.width,
        createdCardSize.height,
      ),
      parameter_mappings: [],
      visualization_settings: {},
    };
    _.extend(dashcard, dashcardOverrides);
    dispatch(createAction(ADD_CARD_TO_DASH)(dashcard));
  };
};

export const addMarkdownDashCardToDashboard = function ({ dashId, tabId }) {
  trackCardCreated("text", dashId);

  const virtualTextCard = {
    ...createCard(),
    display: "text",
    archived: false,
  };

  const dashcardOverrides = {
    card: virtualTextCard,
    visualization_settings: {
      virtual_card: virtualTextCard,
    },
  };
  return addDashCardToDashboard({
    dashId: dashId,
    dashcardOverrides: dashcardOverrides,
    tabId,
  });
};

export const addHeadingDashCardToDashboard = function ({ dashId, tabId }) {
  trackCardCreated("heading", dashId);

  const virtualTextCard = {
    ...createCard(),
    display: "heading",
    archived: false,
  };

  const dashcardOverrides = {
    card: virtualTextCard,
    visualization_settings: {
      virtual_card: virtualTextCard,
      "dashcard.background": false,
    },
  };
  return addDashCardToDashboard({
    dashId: dashId,
    dashcardOverrides: dashcardOverrides,
    tabId,
  });
};

export const addLinkDashCardToDashboard = function ({ dashId, tabId }) {
  trackCardCreated("link", dashId);

  const virtualLinkCard = {
    ...createCard(),
    display: "link",
    archived: false,
  };

  const dashcardOverrides = {
    card: virtualLinkCard,
    visualization_settings: {
      virtual_card: virtualLinkCard,
    },
  };
  return addDashCardToDashboard({
    dashId: dashId,
    dashcardOverrides: dashcardOverrides,
    tabId,
  });
};

export const addActionToDashboard =
  async ({ dashId, tabId, action, displayType }) =>
  dispatch => {
    trackCardCreated("action", dashId);

    const virtualActionsCard = {
      ...createCard(),
      id: action.model_id,
      display: "action",
      archived: false,
    };

    const buttonLabel = action.name ?? action.id ?? t`Click Me`;

    const dashcardOverrides = {
      action: action.id ? action : null,
      action_id: action.id,
      card_id: action.model_id,
      card: virtualActionsCard,
      visualization_settings: {
        actionDisplayType: displayType ?? "button",
        virtual_card: virtualActionsCard,
        "button.label": buttonLabel,
      },
    };

    dispatch(
      addDashCardToDashboard({
        dashId: dashId,
        dashcardOverrides: dashcardOverrides,
        tabId,
      }),
    );
  };

export const addPlaceholderCardToDashboard =
  ({ dashId, tabId }) =>
  dispatch => {
    dispatch(
      addDashCardToDashboard({
        dashId,
        tabId,
        dashcardOverrides: createPlaceholderDashCard(),
      }),
    );
  };

export const addSectionToDashboard =
  ({ dashId, tabId, layoutId }) =>
  (dispatch, getState) => {
    const layout = layoutOptions.find(l => l.id === layoutId);

    if (!layout) {
      return;
    }

    const dashboardState = getState().dashboard;
    const dashcards = getExistingDashCards(
      dashboardState.dashboards,
      dashboardState.dashcards,
      dashId,
      tabId,
    );

    const position = getPositionForNewDashCard(
      dashcards,
      GRID_WIDTH,
      30, // a lot of free height
    );

    const newDashcards = layout.getLayout(position);

    newDashcards.forEach(dc =>
      dispatch(
        addDashCardToDashboard({
          dashId,
          tabId,
          dashcardOverrides: dc,
        }),
      ),
    );
  };
