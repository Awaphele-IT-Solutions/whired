import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';

import Button from '../components/Button';
import DotMeter from '../components/dot/DotMeter';
import DotText from '../components/dot/DotText';
import Screen from '../components/Screen';
import Tile from '../components/Tile';
import { supabase } from '../lib/supabase';
import { colors, fonts } from '../lib/theme';
import { useTabActive } from '../navigation/tabs';

const FIELDS = ['situation', 'task', 'action', 'result'];

export default function StoriesScreen() {
  const navigation = useNavigation();
  const isActive = useTabActive('stories');
  const isFocused = useIsFocused();
  const [stories, setStories] = useState([]);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('star_stories')
      .select('*')
      .order('updated_at', { ascending: false });
    if (err) setError("Couldn't load your stories. Pull the tab again to retry.");
    else {
      setError(null);
      setStories(data ?? []);
    }
  }, []);

  useEffect(() => {
    if (isActive && isFocused) load();
  }, [isActive, isFocused, load]);

  const open = (story) => navigation.navigate('StoryEdit', { story });

  return (
    <Screen>
      <DotText text="STORIES" dot={5} gap={2} />
      <Text style={styles.body}>
        Prepare five to eight real stories. Most behavioural questions can be
        answered by adapting one of them. Each has four parts: Situation, Task,
        Action, Result.
      </Text>

      <Button title="Write a new story" onPress={() => open(undefined)} style={{ marginBottom: 20 }} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {stories.map((s, i) => {
        const filled = FIELDS.filter((f) => (s[f] || '').trim()).length;
        return (
          <Tile
            key={s.id}
            index={String(i + 1).padStart(2, '0')}
            label="Story"
            style={{ marginBottom: 12 }}
            right={<DotMeter value={(filled / 4) * 100} count={4} dot={6} gap={4} />}
            onPress={() => open(s)}
            accessibilityLabel={'Edit story ' + s.title}
          >
            <Text style={styles.title} numberOfLines={2}>
              {s.title}
            </Text>
            {(s.result || '').trim() ? (
              <Text style={styles.preview} numberOfLines={2}>
                {s.result}
              </Text>
            ) : (
              <Text style={styles.preview}>No result written yet.</Text>
            )}
          </Tile>
        );
      })}

      {stories.length === 0 && !error ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No stories yet. Start with a time you solved a real problem, then
            add what you did and what changed because of it.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 20,
    color: colors.mute,
    marginTop: 22,
    marginBottom: 24,
  },
  title: { fontFamily: fonts.monoBold, fontSize: 15, lineHeight: 22, color: colors.ink },
  preview: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 18,
    color: colors.mute,
    marginTop: 8,
  },
  error: { fontFamily: fonts.mono, fontSize: 12, color: colors.accent, marginBottom: 14 },
  empty: { paddingVertical: 8 },
  emptyText: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 19, color: colors.faint },
});
