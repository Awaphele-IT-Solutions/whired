import React, { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

import Button from '../components/Button';
import Field from '../components/Field';
import Screen from '../components/Screen';
import { supabase } from '../lib/supabase';
import { colors, fonts } from '../lib/theme';

export default function StoryEditScreen({ navigation, route }) {
  const existing = route.params?.story;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [situation, setSituation] = useState(existing?.situation ?? '');
  const [task, setTask] = useState(existing?.task ?? '');
  const [action, setAction] = useState(existing?.action ?? '');
  const [result, setResult] = useState(existing?.result ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    if (!title.trim()) {
      setError('Give the story a short title so you can find it later.');
      return;
    }
    setSaving(true);
    setError(null);
    const values = {
      title: title.trim(),
      situation: situation.trim(),
      task: task.trim(),
      action: action.trim(),
      result: result.trim(),
    };
    const { error: err } = existing
      ? await supabase.from('star_stories').update(values).eq('id', existing.id)
      : await supabase.from('star_stories').insert(values);
    setSaving(false);
    if (err) {
      setError("Couldn't save the story. Check your connection and try again.");
      return;
    }
    navigation.goBack();
  };

  const remove = () => {
    Alert.alert('Delete this story?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error: err } = await supabase
            .from('star_stories')
            .delete()
            .eq('id', existing.id);
          if (err) setError("Couldn't delete the story. Try again.");
          else navigation.goBack();
        },
      },
    ]);
  };

  return (
    <Screen>
      <Text style={styles.heading}>{existing ? 'Edit story' : 'New story'}</Text>

      <Field
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Fixed the onboarding drop-off"
        autoCapitalize="sentences"
      />
      <Field
        label="Situation"
        value={situation}
        onChangeText={setSituation}
        placeholder="What was happening? Give just enough context."
        multiline
      />
      <Field
        label="Task"
        value={task}
        onChangeText={setTask}
        placeholder="What were you responsible for?"
        multiline
        inputStyle={{ minHeight: 90 }}
      />
      <Field
        label="Action"
        value={action}
        onChangeText={setAction}
        placeholder="What did you do, step by step? Use I, not we."
        multiline
      />
      <Field
        label="Result"
        value={result}
        onChangeText={setResult}
        placeholder="What changed? Add a number if you have one."
        multiline
        inputStyle={{ minHeight: 90 }}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Save story" onPress={save} loading={saving} style={{ marginBottom: 10 }} />
      {existing ? (
        <Button title="Delete story" variant="outline" onPress={remove} style={{ marginBottom: 10 }} />
      ) : null}
      <Button title="Close" variant="ghost" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: fonts.monoBold,
    fontSize: 20,
    color: colors.ink,
    marginTop: 8,
    marginBottom: 24,
  },
  error: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 18,
    color: colors.accent,
    marginBottom: 14,
  },
});
