import { MD3LightTheme } from 'react-native-paper';
import { Colors } from './colors';

export { Colors, Spacing, FontSize } from './colors';

export const AppTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary:    Colors.primary,
    secondary:  Colors.accent,
    background: Colors.background,
    surface:    Colors.surface,
    onPrimary:  '#FFFFFF',
    onSecondary:'#FFFFFF',
    outline:    Colors.border,
  },
  roundness: 10,
};
