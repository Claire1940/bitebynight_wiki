import {
	Rocket,
	Users,
	BookOpen,
	Gift,
	Shield,
	UserCircle,
	Film,
	AlertCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavigationItem {
	key: string // 用于翻译键，如 'codes' -> t('nav.codes')
	path: string // URL 路径，如 '/codes'
	icon: LucideIcon // Lucide 图标组件
	isContentType: boolean // 是否对应 content/ 目录
}

export const NAVIGATION_CONFIG: NavigationItem[] = [
	{ key: 'release-&-access', path: '/release-&-access', icon: Rocket, isContentType: true },
	{ key: 'community', path: '/community', icon: Users, isContentType: false },
	{ key: 'guide', path: '/guide', icon: BookOpen, isContentType: true },
	{ key: 'codes', path: '/codes', icon: Gift, isContentType: true },
	{ key: 'roster', path: '/roster', icon: Shield, isContentType: true },
	{ key: 'character', path: '/character', icon: UserCircle, isContentType: true },
	{ key: 'media', path: '/media', icon: Film, isContentType: true },
	{ key: 'rumors-&-issues', path: '/rumors-&-issues', icon: AlertCircle, isContentType: true },
]

// 从配置派生内容类型列表（用于路由和内容加载）
export const CONTENT_TYPES = NAVIGATION_CONFIG.filter((item) => item.isContentType).map(
	(item) => item.path.slice(1),
) // 移除开头的 '/' -> ['codes', 'build', 'combat', 'guides']

export type ContentType = (typeof CONTENT_TYPES)[number]

// 辅助函数：验证内容类型
export function isValidContentType(type: string): type is ContentType {
	return CONTENT_TYPES.includes(type as ContentType)
}
