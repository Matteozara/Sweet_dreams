import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '../components/Chrome';
import { GlassButton } from '../components/Buttons';
import { GoogleMark } from '../components/Icon';
import { colors, space, type } from '../theme';

export default function WelcomeScreen({ onSignIn }) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  // Placeholder for Google OAuth: no account is contacted yet.
  const signIn = () => {
    setBusy(true);
    setTimeout(onSignIn, 500);
  };

  return (
    <View style={styles.screen}>
      <Header />
      <View style={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.hero}>
          <Text style={type.display}>Welcome.</Text>
          <Text style={styles.sub}>A quiet line under every day.</Text>
        </View>
        <GlassButton
          title="Continue with Google"
          onPress={signIn}
          disabled={busy}
          icon={busy ? <ActivityIndicator size="small" color={colors.lilac} /> : <GoogleMark />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  hero: { flex: 1, justifyContent: 'center', gap: space.sm },
  sub: { ...type.body, color: colors.muted },
});
