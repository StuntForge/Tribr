import React, { useRef, useState } from "react";
import { Dimensions, Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { colors } from "../theme";

// Each slide is a complete, pre-designed image (Skip / Back / Next baked
// into the artwork itself) - these hotspots are just invisible tap targets
// placed over where those buttons already are, expressed as fractions of
// the image so they line up regardless of screen size. Swiping works too,
// so an imprecise hotspot is never the only way through.
const SLIDES = [
  { source: require("../../assets/illustrations/tutorial-screen-1.png"), hasBack: false, next: { left: 0.08, right: 0.92 } },
  { source: require("../../assets/illustrations/tutorial-screen-2.png"), hasBack: true, next: { left: 0.45, right: 0.92 } },
  { source: require("../../assets/illustrations/tutorial-screen-3.png"), hasBack: true, next: { left: 0.45, right: 0.92 } },
  { source: require("../../assets/illustrations/tutorial-screen-4.png"), hasBack: true, next: { left: 0.45, right: 0.92 } },
];
const IMAGE_WIDTH = 1023;
const IMAGE_HEIGHT = 1537;

export default function TutorialPager({ onFinish }: { onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

  const scale = Math.min(screenWidth / IMAGE_WIDTH, screenHeight / IMAGE_HEIGHT);
  const renderedWidth = IMAGE_WIDTH * scale;
  const renderedHeight = IMAGE_HEIGHT * scale;
  const offsetX = (screenWidth - renderedWidth) / 2;
  const offsetY = (screenHeight - renderedHeight) / 2;

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, i));
    setIndex(clamped);
    scrollRef.current?.scrollTo({ x: clamped * screenWidth, animated: true });
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / screenWidth));
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={{ width: screenWidth, height: screenHeight }}>
            <Image
              source={slide.source}
              style={{
                position: "absolute",
                left: offsetX,
                top: offsetY,
                width: renderedWidth,
                height: renderedHeight,
              }}
              resizeMode="contain"
            />
            <Pressable
              accessibilityLabel="Skip tutorial"
              onPress={onFinish}
              style={{
                position: "absolute",
                top: offsetY + renderedHeight * 0.02,
                left: offsetX + renderedWidth * 0.68,
                width: renderedWidth * 0.3,
                height: renderedHeight * 0.06,
              }}
            />
            {slide.hasBack && (
              <Pressable
                accessibilityLabel="Back"
                onPress={() => goTo(i - 1)}
                style={{
                  position: "absolute",
                  top: offsetY + renderedHeight * 0.9,
                  left: offsetX + renderedWidth * 0.06,
                  width: renderedWidth * 0.36,
                  height: renderedHeight * 0.08,
                }}
              />
            )}
            <Pressable
              accessibilityLabel={i === SLIDES.length - 1 ? "Finish tutorial" : "Next"}
              onPress={() => (i === SLIDES.length - 1 ? onFinish() : goTo(i + 1))}
              style={{
                position: "absolute",
                top: offsetY + renderedHeight * 0.9,
                left: offsetX + renderedWidth * slide.next.left,
                width: renderedWidth * (slide.next.right - slide.next.left),
                height: renderedHeight * 0.08,
              }}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
