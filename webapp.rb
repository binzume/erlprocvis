require 'sinatra/base'
require 'sinatra/reloader'
require_relative('erlang')
require 'json'


class WebApp < Sinatra::Base
  configure :development do
    register Sinatra::Reloader
  end

  configure do
    set :public_folder, 'public'
    set :target_host, 'localhost'

    selfnode = "test01@hoge"
    settings.erl.down() if settings.respond_to?(:erl)
    cookie = File.read(ENV['HOME']+"/.erlang.cookie")
    erl = Erlang::Erl.new(selfnode, cookie, settings.target_host, false)
    set :erl, erl
  end

  get "/" do
    redirect '/index.html'
  end

  helpers do
    def assoc_to_hash(assoc)
      Hash[assoc.map{|e|
        if e.is_a?(Erlang::Tuple)
          [e.to_a[0], e.to_a[1]]
        else
          [nil, e]
        end
      }]
    end

    def proc_info(node, pid)
      erl = settings.erl
      info = erl.rpc_call(node, :erlang, :process_info, [pid, [:initial_call, :links, :monitors, :message_queue_len, :total_heap_size, :registered_name, :trap_exit]])
      if info != :undefined
        infomap = assoc_to_hash(info)
        monitors = infomap[:monitors].map{|m| m[1]}
        registered_name = infomap[:registered_name].empty? ? nil : infomap[:registered_name];
        initial_call = infomap[:initial_call][0].to_s + ":" + infomap[:initial_call][1].to_s + "/" + infomap[:initial_call][2].to_s
        if infomap[:initial_call][0] == :proc_lib
          d = erl.rpc_call(node, :proc_lib, :translate_initial_call, [pid])
          initial_call = d[0].to_s + ":" + d[1].to_s
        end
        {id: pid, alive: true, initial_call: initial_call, registered_name: registered_name,
          monitors: monitors, links: infomap[:links], total_heap_size: infomap[:total_heap_size], trap_exit: (infomap[:trap_exit] == :true),
           message_queue_len: infomap[:message_queue_len] }
      else
        {name: pid, alive: false}
      end
    end
  end

  get '/procs' do
      erl = settings.erl

      if erl.nodes.empty?
        # connect to nodes.
        Erlang::Epmd.names(settings.target_host).each{|name, port| erl.connect("#{name}@#{settings.target_host}", port) }
      end

      proc_infos = erl.nodes.reduce([]){|acc, node|
        procs = erl.rpc_call(node, :erlang, :processes, [])
        acc += procs.map{|pid|
          proc_info(node, pid)
        }
      }

      content_type :json
      JSON.generate({status: 'ok', procs: proc_infos})
  end

  get '/nodes' do
      erl = settings.erl
      JSON.generate({status: 'ok', nodes: erl.nodes})
  end

  get '/nodes/:node' do
      erl = settings.erl
      if params['node'] =~/^@([\w\.\-]+)$/
        host = $1
        nodes = Erlang::Epmd.names(host).map{|name, port| "#{name}@#{host}" }
        content_type :json
        JSON.generate({status: 'ok', nodes: nodes})
      else
        content_type :json
        node = params['node']
        nodeinfo = nil
        if erl.nodes.include?(node)
          nodeinfo = {memory: assoc_to_hash(erl.rpc_call(node, :erlang, :memory, []))}
        end
        JSON.generate({status: 'ok', connected: erl.nodes.include?(node), node: nodeinfo})
      end
  end

  get '/nodes/:node/procs' do
      erl = settings.erl
      node = params['node']
      unless erl.nodes.include?(params['node'])
        erl.connect(params['node'])
      end

      procs = erl.rpc_call(node, :erlang, :processes, [])
      proc_infos = procs.map{|pid|
        proc_info(node, pid)
      }

      content_type :json
      JSON.generate({status: 'ok', processes: proc_infos})
  end

  get '/nodes/:node/procs/:pid' do
      erl = settings.erl
      node = params['node']
      pida = params['pid'].split('.')
      pid = Erlang::Pid.new(node, pida[1].to_i, pida[2].to_i, pida[0].to_i)
      p pid
      content_type :json
      JSON.generate({status: 'ok', process: proc_info(node, pid)})
  end

  delete '/nodes/:node/procs/:pid' do
      erl = settings.erl
      node = params['node']
      pida = params['pid'].split('.')
      pid = Erlang::Pid.new(node, pida[1].to_i, pida[2].to_i, pida[0].to_i)

      rr = erl.rpc_call(node, :erlang, :exit, [pid, :kill])

      content_type :json
      JSON.generate({status: 'ok', result: rr})
  end

  post '/nodes/:node/exec' do
      erl = settings.erl
      node = params['node']
      code = params['code']
      pida = params['pid'].split('.')
      pid = Erlang::Pid.new(node, pida[1].to_i, pida[2].to_i, pida[0].to_i)

      rr = erl.eval(node, code)

      content_type :json
      JSON.generate({status: 'ok', result: rr})
  end
end
