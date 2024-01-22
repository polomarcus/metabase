/* eslint-disable react/prop-types */
import { useMemo } from "react";
import cx from "classnames";
import { DndContext, useSensor, PointerSensor } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";

import { Icon } from "metabase/ui";
import { getVisibleParameters } from "metabase/parameters/utils/ui";
import { Sortable } from "metabase/core/components/Sortable";
import { ParameterWidget } from "./ParameterWidget";

function ParametersList({
  className,

  parameters,
  question,
  dashboard,
  editingParameter,

  isFullscreen,
  isNightMode,
  hideParameters,
  isEditing,
  vertical,
  commitImmediately,

  setParameterValueToDefault,
  setParameterValue,
  setParameterIndex,
  setEditingParameter,
}) {
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 0 },
  });
  const visibleValuePopulatedParameters = useMemo(
    () => getVisibleParameters(parameters, hideParameters),
    [parameters, hideParameters],
  );

  const handleSortStart = () => {
    document.body.classList.add("grabbing");
  };

  const handleSortEnd = async ({ over, active }) => {
    document.body.classList.remove("grabbing");
    if (setParameterIndex) {
      const newIndex = visibleValuePopulatedParameters.findIndex(
        parameter => parameter.id === over.id,
      );

      setParameterIndex(active.id, newIndex);
    }
  };

  const parameterWidgetIds = visibleValuePopulatedParameters.map(
    param => param.id,
  );

  return visibleValuePopulatedParameters.length > 0 ? (
    <DndContext
      onDragStart={handleSortStart}
      onDragEnd={handleSortEnd}
      sensors={[pointerSensor]}
    >
      <SortableContext items={parameterWidgetIds}>
        <div
          className={cx(
            className,
            "flex align-end flex-wrap",
            vertical ? "flex-column" : "flex-row",
          )}
        >
          {visibleValuePopulatedParameters.map(
            (valuePopulatedParameter, index) => (
              <Sortable
                key={valuePopulatedParameter.id}
                id={valuePopulatedParameter.id}
                disabled={!isEditing}
              >
                <ParameterWidget
                  className={cx({ mb2: vertical })}
                  isEditing={isEditing}
                  isFullscreen={isFullscreen}
                  isNightMode={isNightMode}
                  parameter={valuePopulatedParameter}
                  parameters={parameters}
                  question={question}
                  dashboard={dashboard}
                  editingParameter={editingParameter}
                  setEditingParameter={setEditingParameter}
                  index={index}
                  setValue={
                    setParameterValue &&
                    (value =>
                      setParameterValue(valuePopulatedParameter.id, value))
                  }
                  setParameterValueToDefault={setParameterValueToDefault}
                  commitImmediately={commitImmediately}
                  dragHandle={
                    isEditing && setParameterIndex ? (
                      <div className="flex layout-centered cursor-grab text-inherit">
                        <Icon name="grabber" />
                      </div>
                    ) : null
                  }
                />
              </Sortable>
            ),
          )}
        </div>
      </SortableContext>
    </DndContext>
  ) : null;
}

ParametersList.defaultProps = {
  vertical: false,
  commitImmediately: false,
};

export default ParametersList;
