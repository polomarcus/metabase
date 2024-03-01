import type { FocusEvent } from "react";
import { useMemo } from "react";
import { t } from "ttag";

import { useFieldValuesQuery } from "metabase/common/hooks";
import { checkNotNull } from "metabase/lib/types";
import { Center, Loader } from "metabase/ui";
import * as Lib from "metabase-lib";

import { ListValuePicker } from "./ListValuePicker";
import { SearchValuePicker } from "./SearchValuePicker";
import { StaticValuePicker } from "./StaticValuePicker";
import {
  canListFieldValues,
  canLoadFieldValues,
  canSearchFieldValues,
  isKeyColumn,
} from "./utils";

interface FilterValuePickerProps<T> {
  query: Lib.Query;
  stageIndex: number;
  column: Lib.ColumnMetadata;
  values: T[];
  isAutoFocus?: boolean;
  isCompact?: boolean;
  isMultiple?: boolean;
  onChange: (newValues: T[]) => void;
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
}

interface FilterValuePickerOwnProps extends FilterValuePickerProps<string> {
  placeholder: string;
  isValueValid: (query: string) => boolean;
}

function FilterValuePicker({
  query,
  stageIndex,
  column,
  values: selectedValues,
  placeholder = "",
  isAutoFocus = false,
  isCompact = false,
  isMultiple = false,
  isValueValid,
  onChange,
  onFocus,
  onBlur,
}: FilterValuePickerOwnProps) {
  const fieldInfo = useMemo(
    () => Lib.fieldValuesSearchInfo(query, column),
    [query, column],
  );

  const { data: fieldData, isLoading } = useFieldValuesQuery({
    id: fieldInfo.fieldId ?? undefined,
    enabled: canLoadFieldValues(fieldInfo),
  });

  if (isLoading) {
    return (
      <Center h="2.5rem">
        <Loader data-testid="loading-spinner" />
      </Center>
    );
  }

  if (fieldData && canListFieldValues(fieldData)) {
    return (
      <ListValuePicker
        fieldValues={fieldData.values}
        selectedValues={selectedValues}
        placeholder={t`Search the list`}
        isAutoFocus={isAutoFocus}
        isCompact={isCompact}
        isMultiple={isMultiple}
        isValueValid={isValueValid}
        onChange={onChange}
      />
    );
  }

  if (canSearchFieldValues(fieldInfo, fieldData)) {
    const columnInfo = Lib.displayInfo(query, stageIndex, column);

    return (
      <SearchValuePicker
        fieldId={checkNotNull(fieldInfo.fieldId)}
        searchFieldId={checkNotNull(fieldInfo.searchFieldId)}
        fieldValues={fieldData?.values ?? []}
        selectedValues={selectedValues}
        placeholder={t`Search by ${columnInfo.displayName}`}
        isAutoFocus={isAutoFocus}
        isValueValid={isValueValid}
        onChange={onChange}
      />
    );
  }

  return (
    <StaticValuePicker
      selectedValues={selectedValues}
      placeholder={placeholder}
      isAutoFocus={isAutoFocus}
      isValueValid={isValueValid}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
}

export function StringFilterValuePicker({
  column,
  values,
  ...props
}: FilterValuePickerProps<string>) {
  const isValueValid = (query: string) => {
    return query.trim().length > 0 && !values.includes(query);
  };

  return (
    <FilterValuePicker
      {...props}
      column={column}
      values={values}
      placeholder={isKeyColumn(column) ? t`Enter an ID` : t`Enter some text`}
      isValueValid={isValueValid}
    />
  );
}

export function NumberFilterValuePicker({
  column,
  values,
  onChange,
  ...props
}: FilterValuePickerProps<number>) {
  const isValueValid = (query: string) => {
    const number = parseFloat(query);
    return isFinite(number) && !values.includes(number);
  };

  return (
    <FilterValuePicker
      {...props}
      column={column}
      values={values.map(value => String(value))}
      placeholder={isKeyColumn(column) ? t`Enter an ID` : t`Enter a number`}
      isValueValid={isValueValid}
      onChange={newValue => onChange(newValue.map(value => parseFloat(value)))}
    />
  );
}
