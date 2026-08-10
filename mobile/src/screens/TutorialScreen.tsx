import React from "react";
import TutorialPager from "../components/TutorialPager";

export default function TutorialScreen({ navigation }: any) {
  return <TutorialPager onFinish={() => navigation.goBack()} />;
}
