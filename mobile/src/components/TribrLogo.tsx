import React from "react";
import { Image, StyleSheet } from "react-native";

const LOGO = require("../../assets/illustrations/processed/tribr-logo-header.png");
const ASPECT_RATIO = 1328 / 316;
const HEIGHT = 40;

export default function TribrLogo() {
  return <Image source={LOGO} style={styles.logo} resizeMode="contain" />;
}

const styles = StyleSheet.create({
  logo: { height: HEIGHT, width: HEIGHT * ASPECT_RATIO },
});
