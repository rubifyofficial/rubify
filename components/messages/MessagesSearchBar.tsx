import React, { useEffect, useRef } from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';

const SEARCH_SURFACE = '#FFFDFE';
const SEARCH_BORDER = '#F1DDE3';

interface MessagesSearchBarProps {
  searchQuery: string;
  onChangeText: (text: string) => void;
  onClose: () => void;
}

export function MessagesSearchBar({ searchQuery, onChangeText, onClose }: MessagesSearchBarProps) {
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <View style={styles.searchContainer}>
      <Search size={19} color={Colors.light.textMuted} style={styles.searchIcon} />
      <TextInput
        ref={inputRef}
        style={styles.searchInput}
        placeholder="Buscar mensajes..."
        placeholderTextColor={Colors.light.textMuted}
        value={searchQuery}
        onChangeText={onChangeText}
      />
      <Pressable onPress={onClose} style={styles.closeButton}>
        <X size={18} color={Colors.light.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SEARCH_SURFACE,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 6,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: SEARCH_BORDER,
  },
  searchIcon: { marginRight: 10 },
  searchInput: {
    flex: 1,
    paddingVertical: 4,
    fontSize: 15,
    color: Colors.light.text,
  },
  closeButton: { marginLeft: 10 },
});
