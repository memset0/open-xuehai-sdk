import meta from 'xuehai/meta'
import { LoginConfig } from 'xuehai/index'
import { UserMeta } from 'xuehai/interface'
import { LifeCycle } from 'xuehai/lifecycle'
import md5 from 'md5'
import { merge } from 'lodash'
import superagent, { Response, SuperAgentRequest, SuperAgentStatic } from 'superagent'

export interface HttpConfig {
	sign?: string
	headers?: {
		Tenant?: string
		AppCode?: string
		'XHCore-Version'?: string
	}
	appCode?: string
	apiRoot?: string
	userAgent?: string
}

export type HttpOptions = HttpConfig & {
	login: LoginConfig
}

export class Http {
	agent: SuperAgentStatic
	token: {
		access: string
		refresh: string
	}

	async handleRequest(req: SuperAgentRequest): Promise<Response> {
		req = req.set({
			'User-Agent': this.options.userAgent,
			'Tenant': this.options.headers.Tenant,
			'TenantCode': this.options.headers.Tenant,
			'AppCode': this.options.headers.AppCode,
			UserId: this.user.userId,
			SchoolId: this.user.schoolId,
		})
		req = req.query({
			sign: this.options.sign || generateSign(),
			t: Date.now(),
		})
		if (this.token.refresh) { req = req.set('Authorization', `Bearer ${this.token.refresh}`) }
		return (await req)
	}

	get(uri: string, params: object): Promise<Response> {
		return this.handleRequest(this.agent.get(this.options.apiRoot + uri).query(params))
	}
	post(uri: string, body: object): Promise<Response> {
		return this.handleRequest(this.agent.post(this.options.apiRoot + uri).send(body))
	}

	async login() {
		await this.lifecycle.emit('before-login')
		const res = await this.post('/api/v2/platform/login', {
			...this.options.login,
			password: this.options.login.passwordMd5,
		})
		this.user.userId = res.body.userId
		this.user.userName = res.body.userName
		this.user.schoolId = res.body.schoolId
		this.user.schoolName = res.body.schoolName
		this.user.avatar = res.body.avatar
		this.user.roles = res.body.roles
		this.token.access = res.body.accessToken
		this.token.refresh = res.body.refreshToken
		await this.lifecycle.emit('login', () => ({ user: this.user, token: this.token }))
		return res
	}

	constructor(
		public options: HttpOptions,
		public user: UserMeta,
		private lifecycle: LifeCycle,
	) {
		this.options.login = merge({
			loginType: meta.loginType,
			mdmVersionCode: meta.mdmVersionCode,
			mdmVersionName: meta.mdmVersionName,
			osDisplay: options.login.osDisplay || 'SM-P335C',
		}, this.options.login)

		this.options = merge({
			headers: {
				AppCode: meta.appCode,
				'XHCore-Version': meta.coreVersion,
			},
			apiRoot: meta.apiRoot,
			userAgent: meta.userAgent
				.replace('{os}', options.login.osDisplay)
				.replace('{device}', options.login.deviceId),
		}, this.options)

		this.token = { access: '', refresh: '' }

		this.agent = superagent.agent()
	}
}


function generateSign(): string {
	return md5(String(Math.random()))
}