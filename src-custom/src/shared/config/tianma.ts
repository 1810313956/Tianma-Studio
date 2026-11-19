/**
 * Tianma Studio 对外身份常量。
 *
 * 所有面向用户的外链与联系方式都从这里取，替换站点/邮箱时只改本文件即可。
 * 注意：本文件只放「自有」地址；上游服务端点（模型 API、分析 SDK 等）不要放进来。
 */

/** 主站 */
export const TIANMA_SITE_URL = 'https://tianma.studio'

/** 帮助文档（中英文同域，统一入口） */
export const TIANMA_DOCS_URL = 'https://tianma.studio/docs'

/** 版本发布说明 / 下载页 */
export const TIANMA_RELEASES_URL = 'https://tianma.studio/releases'

/** 代码仓库（Get Started 计划：先占位，换成自有仓库后改这一处） */
export const TIANMA_REPO_URL = 'https://github.com/tianma-studio/tianma-studio'

/** 问题反馈（仓库 issue 选择页） */
export const TIANMA_ISSUES_URL = `${TIANMA_REPO_URL}/issues/new/choose`

/** 支持邮箱 */
export const TIANMA_SUPPORT_EMAIL = 'tly808215@gmail.com'

/** 文档站内页拼接，path 需以 / 开头 */
export function tianmaDocsUrl(path: string): string {
  return `${TIANMA_DOCS_URL}${path.startsWith('/') ? path : `/${path}`}`
}
