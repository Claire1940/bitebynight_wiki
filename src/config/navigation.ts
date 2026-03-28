import { BookOpen, Skull, Map, Target, Shirt, Gift, ScrollText, Newspaper } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavigationItem {
	key: string // 用于翻译键，如 'codes' -> t('nav.codes')
	path: string // URL 路径，如 '/codes'
	icon: LucideIcon // Lucide 图标组件
	isContentType: boolean // 是否对应 content/ 目录
}

export const NAVIGATION_CONFIG: NavigationItem[] = [
	{ key: 'classes', path: '/classes', icon: BookOpen, isContentType: true },
	{ key: 'killers', path: '/killers', icon: Skull, isContentType: true },
	{ key: 'maps', path: '/maps', icon: Map, isContentType: true },
	{ key: 'objectives', path: '/objectives', icon: Target, isContentType: true },
	{ key: 'skins', path: '/skins', icon: Shirt, isContentType: true },
	{ key: 'codes', path: '/codes', icon: Gift, isContentType: true },
	{ key: 'lore', path: '/lore', icon: ScrollText, isContentType: true },
	{ key: 'news', path: '/news', icon: Newspaper, isContentType: true },
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
