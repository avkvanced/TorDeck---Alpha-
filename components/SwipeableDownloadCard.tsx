import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Platform,
} from 'react-native';
import { Trash2, CheckSquare, Square } from 'lucide-react-native';
import Colors from '@/constants/colors';
import DownloadCard from '@/components/DownloadCard';
import { DownloadSource } from '@/types/torbox';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 80;
const DELETE_WIDTH = 90;

interface SwipeableDownloadCardProps {
  id: number;
  name: string;
  size: number;
  progress: number;
  downloadSpeed: number;
  eta: number;
  downloadFinished: boolean;
  downloadState: string;
  createdAt: string;
  source: DownloadSource;
  filesCount: number;
  isSelected: boolean;
  isSelecting: boolean;
  onDelete: () => void;
  onToggleSelect: () => void;
  onPress?: () => void;
}

function SwipeableDownloadCardInner(props: SwipeableDownloadCardProps) {
  const {
    id,
    name,
    size,
    progress,
    downloadSpeed,
    eta,
    downloadFinished,
    downloadState,
    createdAt,
    source,
    filesCount,
    isSelected,
    isSelecting,
    onDelete,
    onToggleSelect,
    onPress,
  } = props;

  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const resetPosition = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 40,
      friction: 8,
    }).start();
    isOpen.current = false;
  }, [translateX]);

  const openDelete = useCallback(() => {
    Animated.spring(translateX, {
      toValue: -DELETE_WIDTH,
      useNativeDriver: true,
      tension: 40,
      friction: 8,
    }).start();
    isOpen.current = true;
  }, [translateX]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        if (isSelecting) return false;
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        if (isSelecting) return;
        const newX = isOpen.current
          ? Math.min(0, Math.max(-DELETE_WIDTH * 1.5, -DELETE_WIDTH + gestureState.dx))
          : Math.min(0, Math.max(-DELETE_WIDTH * 1.5, gestureState.dx));
        translateX.setValue(newX);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isSelecting) return;
        if (isOpen.current) {
          if (gestureState.dx > SWIPE_THRESHOLD / 2) {
            resetPosition();
          } else {
            openDelete();
          }
        } else {
          if (gestureState.dx < -SWIPE_THRESHOLD) {
            openDelete();
          } else {
            resetPosition();
          }
        }
      },
    })
  ).current;

  const handleDelete = useCallback(() => {
    Animated.timing(translateX, {
      toValue: -SCREEN_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onDelete();
    });
  }, [translateX, onDelete]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.cardRow}>
          {isSelecting && (
            <TouchableOpacity
              style={styles.selectBtn}
              onPress={onToggleSelect}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {isSelected ? (
                <CheckSquare size={22} color={Colors.primary} />
              ) : (
                <Square size={22} color={Colors.textTertiary} />
              )}
            </TouchableOpacity>
          )}
          <View style={styles.webCardShell}>
            <View style={[styles.cardWrap, !isSelecting && styles.webCardWrapWithDelete]}>
              <DownloadCard
                id={id}
                name={name}
                size={size}
                progress={progress}
                downloadSpeed={downloadSpeed}
                eta={eta}
                downloadFinished={downloadFinished}
                downloadState={downloadState}
                createdAt={createdAt}
                source={source}
                filesCount={filesCount}
                onPress={isSelecting ? onToggleSelect : onPress}
                expandable={!isSelecting && !downloadFinished}
              />
            </View>
            {!isSelecting && (
              <TouchableOpacity
                style={styles.webDeleteBtn}
                onPress={onDelete}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Trash2 size={18} color={Colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.deleteBackground}>
        <TouchableOpacity style={styles.deleteAction} onPress={handleDelete}>
          <Trash2 size={22} color="#fff" />
          <Text style={styles.deleteActionText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[styles.cardRow, { transform: [{ translateX }] }]}
        {...(isSelecting ? {} : panResponder.panHandlers)}
      >
        {isSelecting && (
          <TouchableOpacity
            style={styles.selectBtn}
            onPress={onToggleSelect}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {isSelected ? (
              <CheckSquare size={22} color={Colors.primary} />
            ) : (
              <Square size={22} color={Colors.textTertiary} />
            )}
          </TouchableOpacity>
        )}
        <View style={styles.cardWrap}>
          <DownloadCard
            id={id}
            name={name}
            size={size}
            progress={progress}
            downloadSpeed={downloadSpeed}
            eta={eta}
            downloadFinished={downloadFinished}
            downloadState={downloadState}
            createdAt={createdAt}
            source={source}
            filesCount={filesCount}
            onPress={isSelecting ? onToggleSelect : onPress}
            expandable={!isSelecting && !downloadFinished}
          />
        </View>
      </Animated.View>
    </View>
  );
}

export default React.memo(SwipeableDownloadCardInner);

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: 0,
  },
  deleteBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 8,
    width: DELETE_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.danger,
    borderRadius: 14,
  },
  deleteAction: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deleteActionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.background,
  },
  selectBtn: {
    width: 36,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
    marginTop: 8,
  },
  cardWrap: {
    flex: 1,
  },
  webCardShell: {
    flex: 1,
    position: 'relative',
  },
  webCardWrapWithDelete: {
    paddingRight: DELETE_WIDTH + 6,
  },
  webDeleteBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_WIDTH,
    borderRadius: 14,
    backgroundColor: Colors.danger + '14',
    borderWidth: 1,
    borderColor: Colors.danger + '2f',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
