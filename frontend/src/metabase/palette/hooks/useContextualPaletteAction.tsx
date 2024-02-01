import type { ReactNode, Ref } from "react";
import { useEffect } from "react";
import { useDispatch } from "metabase/lib/redux";
import {
  registerPaletteAction,
  unregisterPaletteAction,
} from "metabase/redux/app";
import type { IconName } from "metabase/ui";
import { Icon } from "metabase/ui";
import { uuid } from "metabase/lib/utils";
import { createPaletteAction } from "../utils";

export const useContextualPaletteAction = (
  palette: boolean | any,
  label: ReactNode | undefined,
  icon: ReactNode,
  ref: Ref<HTMLButtonElement | HTMLLinkElement>,
) => {
  const dispatch = useDispatch();

  useEffect(() => {
    if (!palette) {
      return;
    }
    let children = label;
    if (typeof palette === "object" && palette.label) {
      children = palette.label;
    }

    const onClick = () => {
      // Function refs not currently supported for this purpose
      if (typeof ref === "function") {
        return;
      }
      ref?.current?.click();
    };
    const paletteAction = createPaletteAction({children, icon, onClick});

    dispatch(registerPaletteAction(paletteAction));
    return () => {
      dispatch(unregisterPaletteAction(paletteAction));
    };
  }, [dispatch, palette, label, icon, ref]);
};