import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { photoSource } from "@/src/api";
import { makeStyles, rentalPalettes, useTheme } from "@/src/theme";

export type RentalLike = { id: string; cover_photo?: string | null; palette?: number };

// By the rental's position in the host's list (from the server), so each rental gets its own colour.
export function paletteFor(p: RentalLike) {
  if (typeof p.palette === "number") return rentalPalettes[p.palette % rentalPalettes.length];
  let h = 0;
  for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) | 0;
  return rentalPalettes[Math.abs(h) % rentalPalettes.length];
}

// A little Bullpen house scene, coloured per rental.
export function HouseArt({ p, testID }: { p: RentalLike; testID?: string }) {
  const c = paletteFor(p);
  return (
    <Svg width="100%" height="100%" viewBox="0 0 320 150" preserveAspectRatio="xMidYMid slice" testID={testID}>
      <Rect x="0" y="0" width="320" height="150" fill={c.sky} />
      <Circle cx="258" cy="40" r="20" fill={c.sun} />
      <Path d="M0 118 C 60 98, 120 104, 170 114 S 270 100, 320 110 L320 150 L0 150 Z" fill={c.ground} />
      <Rect x="58" y="92" width="6" height="26" rx="2" fill={c.door} />
      <Circle cx="61" cy="84" r="17" fill={c.tree} />
      <Circle cx="272" cy="96" r="11" fill={c.tree} />
      <Rect x="270" y="102" width="4" height="16" rx="2" fill={c.door} />
      <Rect x="186" y="34" width="13" height="28" rx="2" fill={c.roof} />
      <Rect x="112" y="68" width="100" height="56" rx="4" fill={c.wall} stroke={c.door} strokeWidth="3" />
      <Path d="M100 72 L162 26 L224 72 Z" fill={c.roof} stroke={c.door} strokeWidth="3" strokeLinejoin="round" />
      <Rect x="151" y="94" width="22" height="30" rx="3" fill={c.door} />
      <Circle cx="168" cy="110" r="1.8" fill={c.wall} />
      <Rect x="124" y="82" width="18" height="16" rx="3" fill={c.sky} stroke={c.door} strokeWidth="2.5" />
      <Rect x="182" y="82" width="18" height="16" rx="3" fill={c.sky} stroke={c.door} strokeWidth="2.5" />
      <Path d="M150 128 L174 128 L180 138 L144 138 Z" fill={c.wall} opacity={0.7} />
    </Svg>
  );
}

// Cover photo, or the house drawing when there's none.
export function RentalCover({ p, height = 132, busy, testID }: { p: RentalLike; height?: number; busy?: boolean; testID?: string }) {
  const { colors } = useTheme();
  const s = useStyles();
  return (
    <View style={[s.cover, { height }]} testID={testID}>
      {p.cover_photo
        ? <Image source={photoSource(p.cover_photo)} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} testID={testID ? `${testID}-photo` : undefined} />
        : <HouseArt p={p} testID={testID ? `${testID}-art` : undefined} />}
      {busy && <View style={[StyleSheet.absoluteFill, s.busy]}><ActivityIndicator color={colors.onBrandPrimary} /></View>}
    </View>
  );
}

// Round thumbnail for rental chips.
export function RentalAvatar({ p, size = 24 }: { p: RentalLike; size?: number }) {
  const c = paletteFor(p);
  const box = { width: size, height: size, borderRadius: size / 2, overflow: "hidden" as const };
  if (p.cover_photo) return <Image source={photoSource(p.cover_photo)} style={box} contentFit="cover" />;
  return (
    <View style={[box, { backgroundColor: c.sky }]}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Rect x="6.5" y="11" width="11" height="8" rx="1" fill={c.wall} stroke={c.door} strokeWidth="1.2" />
        <Path d="M5 11.5 L12 5.5 L19 11.5 Z" fill={c.roof} stroke={c.door} strokeWidth="1.2" strokeLinejoin="round" />
        <Rect x="10.7" y="14" width="2.6" height="5" rx="0.6" fill={c.door} />
      </Svg>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  cover: { overflow: "hidden", backgroundColor: c.surfaceTertiary },
  busy: { backgroundColor: c.overlay, alignItems: "center", justifyContent: "center" },
}));
