import React from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Search, X } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

function SearchBarInner({ value, onChangeText, placeholder = 'Search library...' }: SearchBarProps) {
  return (
    <View style={styles.container}>
      <Search size={18} color={Colors.textTertiary} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        testID="search-input"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={18} color={Colors.textTertiary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default React.memo(SearchBarInner);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    padding: 0,
    letterSpacing: 0.1,
  },
});
