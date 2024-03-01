import styled from "@emotion/styled";

import { HoverCard } from "metabase/ui";

export const WidthBound = styled.div`
  width: 300px;
  font-size: 14px;
`;

export const Dropdown = styled(HoverCard.Dropdown)`
  overflow: visible;
`;

export const Target = styled.div`
  position: absolute;
  width: 100%;
  left: -10px;
  right: -10px;
  top: -10px;
  bottom: -10px;
  min-height: 5px;
`;