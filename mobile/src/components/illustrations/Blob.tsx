import React from "react";
import Svg, { Path } from "react-native-svg";

// A couple of hand-drawn organic blob shapes (not a plain circle/rounded
// rect) used behind icons for empty states etc, so those moments read as a
// small illustration rather than an icon glyph in a box.
const VARIANTS = [
  "M45.8,-51.5C58.3,-42.9,66.2,-26.9,68.4,-10.2C70.6,6.5,67.1,23.9,57.4,36.9C47.7,49.9,31.8,58.5,14.6,63.1C-2.6,67.7,-21.1,68.3,-36.6,60.9C-52.1,53.5,-64.6,38,-69.3,20.3C-74,2.6,-70.9,-17.3,-61.1,-32.6C-51.3,-47.9,-34.8,-58.6,-17.9,-64.3C-1,-70,16.3,-70.7,31.1,-64.9C45.9,-59,58.2,-46.6,45.8,-51.5Z",
  "M39.7,-46.6C51.4,-38.1,60.6,-24.9,63.6,-10.2C66.6,4.5,63.4,20.7,54.8,33.4C46.2,46.1,32.2,55.3,16.5,60.1C0.8,64.9,-16.6,65.3,-31.5,58.9C-46.4,52.5,-58.8,39.3,-64.2,23.6C-69.6,7.9,-68,-10.3,-60.4,-25.1C-52.8,-39.9,-39.2,-51.3,-25,-58C-10.8,-64.7,4,-66.7,18.3,-63C32.6,-59.3,46.4,-49.9,39.7,-46.6Z",
];

export default function Blob({ size = 96, color, variant = 0 }: { size?: number; color: string; variant?: 0 | 1 }) {
  return (
    <Svg width={size} height={size} viewBox="-80 -80 160 160">
      <Path d={VARIANTS[variant]} fill={color} />
    </Svg>
  );
}
